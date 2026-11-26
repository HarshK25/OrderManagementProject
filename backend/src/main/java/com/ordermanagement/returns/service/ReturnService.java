package com.ordermanagement.returns.service;

import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ConflictException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.payment.entity.Payment;
import com.ordermanagement.payment.entity.PaymentStatus;
import com.ordermanagement.payment.repository.PaymentRepository;
import com.ordermanagement.returns.dto.AdminReturnActionDto;
import com.ordermanagement.returns.dto.ReturnRequestDto;
import com.ordermanagement.returns.dto.ReturnResponse;
import com.ordermanagement.returns.entity.ReturnRequest;
import com.ordermanagement.returns.repository.ReturnRepository;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Business logic for the Return & Refund workflow.
 *
 * Flow:
 *  1. Customer: requestReturn()         → order: DELIVERED → RETURN_REQUESTED
 *  2. Admin:    approveReturn()         → order: RETURN_REQUESTED → RETURN_APPROVED  + email
 *  3. Admin:    rejectReturn()          → order: RETURN_REQUESTED → RETURN_REJECTED  + email
 *  4. Admin:    markPickupCompleted()   → order: RETURN_APPROVED  → PICKUP_COMPLETED
 *               then immediately:       → Razorpay refund API call
 *               then:                  → order: PICKUP_COMPLETED → REFUNDED           + email
 *
 * Business rules:
 *  - Return allowed only within 7 days of deliveredAt.
 *  - Only DELIVERED orders can be returned.
 *  - One return request per order (enforced by DB unique constraint + service check).
 *  - Razorpay refund is best-effort: if payment_id is missing, we still mark REFUNDED
 *    and log a warning so the team can process it manually.
 *  - Stock is NOT restored (physical item comes back manually in real life).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReturnService {

    private static final int RETURN_WINDOW_DAYS = 7;

    private final ReturnRepository returnRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final AppProperties appProperties;
    private final JavaMailSender mailSender;

    // ── Customer: request return ─────────────────────────────────────────────

    @Transactional
    public ReturnResponse requestReturn(Long orderId, Long userId, ReturnRequestDto dto) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        // Must belong to this user
        if (!order.getUser().getId().equals(userId)) {
            throw new BadRequestException("Order does not belong to you");
        }

        // Must be DELIVERED
        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BadRequestException(
                    "Return can only be requested for DELIVERED orders. Current status: " + order.getStatus());
        }

        // Must be within 7-day window
        if (order.getDeliveredAt() == null ||
                order.getDeliveredAt().isBefore(LocalDateTime.now().minusDays(RETURN_WINDOW_DAYS))) {
            throw new BadRequestException(
                    "Return window has expired. Returns must be requested within " + RETURN_WINDOW_DAYS + " days of delivery.");
        }

        // One return per order
        if (returnRepository.existsByOrderId(orderId)) {
            throw new ConflictException("A return request already exists for this order");
        }

        // Transition order status
        order.transitionTo(OrderStatus.RETURN_REQUESTED, "Customer requested return: " + dto.reason(), order.getUser().getEmail());

        // Create return request record
        ReturnRequest returnRequest = ReturnRequest.builder()
                .order(order)
                .reason(dto.reason())
                .itemCondition(dto.itemCondition())
                .build();

        returnRequest = returnRepository.save(returnRequest);
        orderRepository.save(order);

        log.info("Return requested for order {} by user {}", order.getOrderNumber(), userId);
        return ReturnResponse.from(returnRequest);
    }

    // ── Customer: view return status ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public ReturnResponse getReturnByOrderId(Long orderId, Long userId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (!order.getUser().getId().equals(userId)) {
            throw new BadRequestException("Order does not belong to you");
        }

        ReturnRequest rr = returnRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest for order", orderId));

        return ReturnResponse.from(rr);
    }

    // ── Admin: list all returns ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ReturnResponse> getAllReturns() {
        return returnRepository.findAllWithOrder()
                .stream()
                .map(ReturnResponse::from)
                .toList();
    }

    // ── Admin: get single return ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ReturnResponse getReturnById(Long returnId) {
        ReturnRequest rr = returnRepository.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest", returnId));
        return ReturnResponse.from(rr);
    }

    // ── Admin: approve return ─────────────────────────────────────────────────

    @Transactional
    public ReturnResponse approveReturn(Long returnId, AdminReturnActionDto dto) {
        ReturnRequest rr = findReturnOrThrow(returnId);
        Order order = rr.getOrder();

        order.transitionTo(OrderStatus.RETURN_APPROVED,
                "Return approved by admin. Note: " + dto.adminNote(), "admin");
        rr.setAdminNote(dto.adminNote());

        returnRepository.save(rr);
        orderRepository.save(order);

        // Send email notification
        sendReturnEmail(
                order.getUser().getEmail(),
                order.getUser().getName(),
                order.getOrderNumber(),
                "Return Request Approved",
                "Your return request for order <strong>" + order.getOrderNumber() + "</strong> has been <strong>approved</strong>.<br>"
                        + "Our team will contact you to arrange a pickup.<br>"
                        + (dto.adminNote() != null ? "Note from admin: " + dto.adminNote() : "")
        );

        log.info("Return {} approved for order {}", returnId, order.getOrderNumber());
        return ReturnResponse.from(rr);
    }

    // ── Admin: reject return ──────────────────────────────────────────────────

    @Transactional
    public ReturnResponse rejectReturn(Long returnId, AdminReturnActionDto dto) {
        ReturnRequest rr = findReturnOrThrow(returnId);
        Order order = rr.getOrder();

        order.transitionTo(OrderStatus.RETURN_REJECTED,
                "Return rejected by admin. Reason: " + dto.adminNote(), "admin");
        rr.setAdminNote(dto.adminNote());

        returnRepository.save(rr);
        orderRepository.save(order);

        // Send email notification
        sendReturnEmail(
                order.getUser().getEmail(),
                order.getUser().getName(),
                order.getOrderNumber(),
                "Return Request Rejected",
                "Unfortunately, your return request for order <strong>" + order.getOrderNumber() + "</strong> has been <strong>rejected</strong>.<br>"
                        + (dto.adminNote() != null ? "Reason: " + dto.adminNote() : "Please contact our support team for more details.")
        );

        log.info("Return {} rejected for order {}", returnId, order.getOrderNumber());
        return ReturnResponse.from(rr);
    }

    // ── Admin: mark pickup completed → triggers Razorpay refund ──────────────

    @Transactional
    public ReturnResponse markPickupCompleted(Long returnId) {
        ReturnRequest rr = findReturnOrThrow(returnId);
        Order order = rr.getOrder();

        // 1. Transition to PICKUP_COMPLETED
        order.transitionTo(OrderStatus.PICKUP_COMPLETED,
                "Item picked up by courier. Initiating refund.", "admin");
        orderRepository.save(order);

        // 2. Attempt Razorpay refund
        BigDecimal refundAmount = order.getTotal();
        String razorpayRefundId = initiateRazorpayRefund(order, refundAmount, rr);

        // 3. Transition to REFUNDED
        order.transitionTo(OrderStatus.REFUNDED,
                "Razorpay refund initiated. Refund ID: " + (razorpayRefundId != null ? razorpayRefundId : "N/A"), "system");
        rr.setRefundAmount(refundAmount);
        rr.setRazorpayRefundId(razorpayRefundId);

        returnRepository.save(rr);
        orderRepository.save(order);

        // 4. Send email notification
        sendReturnEmail(
                order.getUser().getEmail(),
                order.getUser().getName(),
                order.getOrderNumber(),
                "Refund Initiated — ₹" + refundAmount,
                "Great news! Your item has been picked up and your refund of <strong>₹" + refundAmount + "</strong> has been initiated.<br>"
                        + "It will reflect in your account within <strong>5-7 business days</strong>.<br>"
                        + (razorpayRefundId != null ? "Refund Reference: <code>" + razorpayRefundId + "</code>" : "")
        );

        log.info("Pickup completed and refund initiated for return {} (order {})", returnId, order.getOrderNumber());
        return ReturnResponse.from(rr);
    }

    // ── Razorpay Refund ───────────────────────────────────────────────────────

    private String initiateRazorpayRefund(Order order, BigDecimal amount, ReturnRequest rr) {
        // Find the verified payment record for this order
        Optional<Payment> paymentOpt = paymentRepository.findByOrderIdAndStatus(
                order.getId(), PaymentStatus.SUCCESS);

        if (paymentOpt.isEmpty()) {
            log.warn("No verified payment found for order {}. Marking REFUNDED without Razorpay call. Manual refund required.",
                    order.getOrderNumber());
            return null;
        }

        String razorpayPaymentId = paymentOpt.get().getRazorpayPaymentId();

        try {
            RazorpayClient client = new RazorpayClient(
                    appProperties.getRazorpay().getKeyId(),
                    appProperties.getRazorpay().getKeySecret()
            );

            // Amount must be in paise (1 INR = 100 paise)
            long amountInPaise = amount.multiply(BigDecimal.valueOf(100)).longValue();

            JSONObject refundRequest = new JSONObject();
            refundRequest.put("amount", amountInPaise);
            refundRequest.put("speed", "normal"); // normal = 5-7 days, optimum = instant if available

            com.razorpay.Refund refund = client.payments.refund(razorpayPaymentId, refundRequest);
            String refundId = refund.get("id");

            log.info("Razorpay refund created: id={} amount={} paise for order {}",
                    refundId, amountInPaise, order.getOrderNumber());
            return refundId;

        } catch (RazorpayException e) {
            log.error("Razorpay refund FAILED for order {}. Manual refund required. Error: {}",
                    order.getOrderNumber(), e.getMessage());
            // Don't rethrow — we still mark the order as REFUNDED and log it.
            // The ops team can process the Razorpay refund manually using the payment_id.
            return null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ReturnRequest findReturnOrThrow(Long returnId) {
        return returnRepository.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest", returnId));
    }

    private void sendReturnEmail(String toEmail, String customerName, String orderNumber,
                                  String subject, String bodyHtml) {
        try {
            MimeMessage mimeMsg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMsg, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject + " [" + orderNumber + "]");
            helper.setText(buildEmailHtml(customerName, bodyHtml), true);
            mailSender.send(mimeMsg);
            log.info("Return email sent to {} | subject: {}", toEmail, subject);
        } catch (MessagingException e) {
            log.error("Failed to send return email to {}: {}", toEmail, e.getMessage());
            // Non-critical — don't throw, the main operation already succeeded
        }
    }

    private String buildEmailHtml(String customerName, String bodyHtml) {
        return """
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: #4F46E5; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 22px;">Order Management System</h1>
                  </div>
                  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <p>Dear <strong>%s</strong>,</p>
                    <p>%s</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="color: #6b7280; font-size: 13px;">
                      Questions? Contact us at <a href="mailto:support@ordermanagement.com">support@ordermanagement.com</a>
                      or call <strong>+91 98765 43210</strong>.
                    </p>
                  </div>
                </body>
                </html>
                """.formatted(customerName, bodyHtml);
    }
}
