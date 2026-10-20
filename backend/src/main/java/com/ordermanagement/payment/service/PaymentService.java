package com.ordermanagement.payment.service;

import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ConflictException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.payment.dto.CreatePaymentResponse;
import com.ordermanagement.payment.dto.PaymentVerifyResponse;
import com.ordermanagement.payment.dto.VerifyPaymentRequest;
import com.ordermanagement.payment.entity.Payment;
import com.ordermanagement.payment.entity.PaymentStatus;
import com.ordermanagement.payment.repository.PaymentRepository;
import com.ordermanagement.user.entity.User;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Razorpay payment integration.
 *
 * Flow:
 *  1. POST /api/payments/create/{orderId}
 *     - Validates the order belongs to the caller and is PENDING_PAYMENT and not expired.
 *     - Calls Razorpay API to create an order (in paise).
 *     - Stores a Payment row with status INITIATED and razorpayOrderId.
 *     - Returns key_id, razorpay_order_id, amount — the frontend opens the popup with these.
 *
 *  2. POST /api/payments/verify
 *     - Frontend sends razorpay_order_id, razorpay_payment_id, razorpay_signature.
 *     - We verify the HMAC-SHA256 signature: HMAC(razorpayOrderId + "|" + razorpayPaymentId, keySecret).
 *     - If valid, lock the order row and move PENDING_PAYMENT → PAID (idempotent — unique constraint
 *       on razorpay_payment_id, and status check under lock).
 *     - Edge case: if the order is already EXPIRED, log it clearly (a refund flow would go here).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final AppProperties appProperties;
    private final EntityManager entityManager;
    private final ApplicationEventPublisher eventPublisher;

    // ── Create Razorpay order ─────────────────────────────────────────

    @Transactional
    public CreatePaymentResponse createPayment(User user, Long orderId) {
        Order order = orderRepository.findByIdAndUserWithDetails(orderId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new BadRequestException("Order " + order.getOrderNumber()
                    + " is not in PENDING_PAYMENT state (current: " + order.getStatus() + ")");
        }

        if (order.getExpiresAt() != null && LocalDateTime.now().isAfter(order.getExpiresAt())) {
            throw new BadRequestException("Payment window for order " + order.getOrderNumber()
                    + " has expired. Please place a new order.");
        }

        // Amount in paise (Razorpay uses the smallest currency unit)
        long amountPaise = order.getTotal()
                .multiply(BigDecimal.valueOf(100))
                .longValue();

        try {
            AppProperties.Razorpay rzConfig = appProperties.getRazorpay();
            RazorpayClient client = new RazorpayClient(rzConfig.getKeyId(), rzConfig.getKeySecret());

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountPaise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", order.getOrderNumber());

            com.razorpay.Order rzOrder = client.orders.create(orderRequest);
            String razorpayOrderId = rzOrder.get("id");

            // Persist a payment record
            Payment payment = Payment.builder()
                    .order(order)
                    .razorpayOrderId(razorpayOrderId)
                    .amount(order.getTotal())
                    .status(PaymentStatus.INITIATED)
                    .build();
            paymentRepository.save(payment);

            log.info("Razorpay order created: {} for order {}", razorpayOrderId, order.getOrderNumber());

            return new CreatePaymentResponse(
                    rzConfig.getKeyId(),
                    razorpayOrderId,
                    order.getTotal(),
                    "INR",
                    order.getOrderNumber()
            );

        } catch (RazorpayException e) {
            log.error("Razorpay order creation failed for orderId={}: {}", orderId, e.getMessage());
            throw new BadRequestException("Payment gateway error: " + e.getMessage());
        }
    }

    // ── Verify payment signature ──────────────────────────────────────

    @Transactional
    public PaymentVerifyResponse verifyPayment(VerifyPaymentRequest request) {
        // 1. Verify HMAC-SHA256 signature
        AppProperties.Razorpay rzConfig = appProperties.getRazorpay();
        String payload = request.razorpayOrderId() + "|" + request.razorpayPaymentId();

        boolean signatureValid;
        try {
            signatureValid = Utils.verifySignature(payload, request.razorpaySignature(), rzConfig.getKeySecret());
        } catch (RazorpayException e) {
            log.warn("Signature verification threw exception: {}", e.getMessage());
            signatureValid = false;
        }

        if (!signatureValid) {
            log.warn("Invalid Razorpay signature for paymentId={}", request.razorpayPaymentId());
            throw new BadRequestException("Payment signature verification failed");
        }

        // 2. Idempotency — reject duplicate payment IDs early
        if (paymentRepository.findByRazorpayPaymentId(request.razorpayPaymentId()).isPresent()) {
            log.info("Duplicate verify call for paymentId={} — already processed", request.razorpayPaymentId());
            return new PaymentVerifyResponse(true, "Payment already recorded");
        }

        // 3. Find the payment record by Razorpay order ID
        Payment payment = paymentRepository.findByRazorpayOrderId(request.razorpayOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Payment with razorpayOrderId "
                        + request.razorpayOrderId() + " not found"));

        // 4. Lock the order row to prevent race conditions
        Order order = entityManager.find(Order.class, payment.getOrder().getId(),
                LockModeType.PESSIMISTIC_WRITE);

        // 5. Handle edge case: payment arrived after order expired
        if (order.getStatus() == OrderStatus.EXPIRED) {
            log.warn("Payment {} arrived for EXPIRED order {} — flagging for manual refund review",
                    request.razorpayPaymentId(), order.getOrderNumber());
            // In a production system, trigger an automatic refund via Razorpay Refunds API here.
            // For this build we record the payment and flag it for manual review.
            payment.setRazorpayPaymentId(request.razorpayPaymentId());
            payment.setStatus(PaymentStatus.FAILED); // mark FAILED; no state change on order
            paymentRepository.save(payment);
            throw new ConflictException("Order " + order.getOrderNumber()
                    + " has expired. Please contact support for refund.");
        }

        // 6. Only accept if PENDING_PAYMENT (idempotency guard under lock)
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.info("Order {} already in status {} — ignoring payment", order.getOrderNumber(), order.getStatus());
            return new PaymentVerifyResponse(true, "Payment already processed");
        }

        // 7. Mark payment as SUCCESS
        payment.setRazorpayPaymentId(request.razorpayPaymentId());
        payment.setStatus(PaymentStatus.SUCCESS);
        paymentRepository.save(payment);

        // 8. Transition order to PAID
        order.transitionTo(OrderStatus.PAID, "Payment verified via Razorpay", "razorpay");
        orderRepository.save(order);

        log.info("Order {} marked PAID via Razorpay payment {}", order.getOrderNumber(),
                request.razorpayPaymentId());

        // 9. Publish notification event AFTER COMMIT
        //    Use "order.placed" routing key so the customer receives the
        //    "Order Placed" confirmation email only after backend verifies payment.
        eventPublisher.publishEvent(new com.ordermanagement.notification.service.OrderEventMessage(
                "order.placed", order.getId(), order.getOrderNumber(),
                order.getUser().getEmail(), order.getUser().getName(), order.getTotal()
        ));

        return new PaymentVerifyResponse(true, "Payment successful. Order " + order.getOrderNumber() + " is now PAID.");
    }
}
