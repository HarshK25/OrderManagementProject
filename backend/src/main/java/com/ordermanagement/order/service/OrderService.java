package com.ordermanagement.order.service;

import com.ordermanagement.audit.service.AuditLogService;
import com.ordermanagement.cart.entity.Cart;
import com.ordermanagement.cart.entity.CartItem;
import com.ordermanagement.cart.service.CartService;
import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.InsufficientStockException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.config.RabbitMQConfig;
import com.ordermanagement.coupon.service.CouponService;
import com.ordermanagement.notification.entity.InAppNotification;
import com.ordermanagement.notification.repository.InAppNotificationRepository;
import com.ordermanagement.order.dto.OrderResponse;
import com.ordermanagement.order.dto.PlaceOrderRequest;
import com.ordermanagement.order.dto.UpdateOrderStatusRequest;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderItem;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.ordermanagement.notification.service.OrderEventMessage;
import com.ordermanagement.payment.repository.PaymentRepository;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Order lifecycle management.
 *
 * Key design decisions:
 *
 * 1. ATOMIC STOCK DECREMENT
 *    Each cart item uses:
 *      UPDATE products SET stock = stock - qty WHERE id = ? AND stock >= qty
 *    If any item returns 0 rows affected → insufficient stock.
 *    Items already decremented are rolled back by the @Transactional boundary.
 *    This avoids any read-then-write race condition.
 *
 * 2. PRICE SNAPSHOT
 *    Each OrderItem captures productName + unitPrice (effectivePrice at order time).
 *    Price and name changes to a product never affect existing orders.
 *
 * 3. STATE MACHINE
 *    All status transitions go through Order.transitionTo() which enforces the
 *    rules and auto-appends an OrderStatusHistory row.
 *
 * 4. STOCK RESTORE ON CANCEL/EXPIRE
 *    When an order moves to CANCELLED or EXPIRED, stock is restored atomically
 *    for each item using productRepository.incrementStock().
 *
 * 5. IDOR PROTECTION
 *    Customer endpoints use findByIdAndUserWithDetails() — a user can only read
 *    and cancel their own orders.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private static final DateTimeFormatter ORDER_DATE_FMT =
            DateTimeFormatter.ofPattern("yyyyMMdd");

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CartService cartService;
    private final AppProperties appProperties;
    private final ApplicationEventPublisher eventPublisher;
    private final PaymentRepository paymentRepository;
    private final CouponService couponService;
    private final InvoicePdfService invoicePdfService;
    private final InAppNotificationRepository notificationRepository;
    private final AuditLogService auditLogService;
    private final RabbitTemplate rabbitTemplate;
    private final jakarta.persistence.EntityManager entityManager;

    // ── Customer: place order ─────────────────────────────────────────

    /**
     * Places an order from the current user's cart.
     *
     * Steps:
     *  1. Load cart and validate it has items
     *  2. Decrement stock atomically for every item (rolls back on failure)
     *  3. Build Order aggregate with price snapshots
     *  4. Persist order
     *  5. Clear cart
     */
    @Transactional
    public OrderResponse placeOrder(User user, PlaceOrderRequest request) {
        // 1. Load cart
        Cart cart = cartService.getOrCreateCart(user);
        if (cart.getId() == null || cart.getItems().isEmpty()) {
            throw new BadRequestException("Cannot place order — your cart is empty");
        }

        // Sort cart items by productId ASC so all concurrent transactions acquire
        // row locks in the exact same global order — mathematically prevents deadlocks.
        List<CartItem> cartItems = new ArrayList<>(cart.getItems());
        cartItems.sort(java.util.Comparator.comparing(ci -> ci.getProduct().getId()));

        // 2. Deadlock-free Pessimistic Write Lock (SELECT ... FOR UPDATE) + Atomic Stock Guard
        //    Serializes competing buyers for the same hot SKU inside one @Transactional boundary;
        //    if any item lacks sufficient stock, the entire transaction rolls back cleanly.
        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discountTotal = BigDecimal.ZERO;

        for (CartItem cartItem : cartItems) {
            Long productId = cartItem.getProduct().getId();
            int qty = cartItem.getQuantity();

            Product product = productRepository.findByIdForUpdate(productId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

            if (!product.isActive() || product.getStock() < qty) {
                throw new InsufficientStockException(product.getName(), qty, product.getStock());
            }

            int rowsUpdated = productRepository.decrementStockIfAvailable(productId, qty);
            if (rowsUpdated == 0) {
                throw new InsufficientStockException(product.getName(), qty, product.getStock());
            }

            BigDecimal unitPrice   = product.getEffectivePrice();
            BigDecimal originalPrice = product.getPrice();
            BigDecimal discount    = originalPrice.subtract(unitPrice)
                                                  .multiply(BigDecimal.valueOf(qty));
            BigDecimal lineTotal   = unitPrice.multiply(BigDecimal.valueOf(qty));

            subtotal     = subtotal.add(originalPrice.multiply(BigDecimal.valueOf(qty)));
            discountTotal = discountTotal.add(discount);

            OrderItem item = OrderItem.builder()
                    .product(product)
                    .productName(product.getName())
                    .unitPrice(unitPrice)
                    .quantity(qty)
                    .lineTotal(lineTotal)
                    .build();
            orderItems.add(item);
        }

        BigDecimal total = subtotal.subtract(discountTotal);

        // Apply optional coupon
        String appliedCoupon = null;
        BigDecimal couponDiscount = BigDecimal.ZERO;
        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            couponDiscount = couponService.calculateDiscount(request.getCouponCode(), total);
            appliedCoupon = request.getCouponCode().trim().toUpperCase();
            total = total.subtract(couponDiscount);
            couponService.incrementUsage(appliedCoupon);
        }

        String paymentMethod = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod().trim().toUpperCase()
                : "ONLINE";
        boolean isCod = "COD".equalsIgnoreCase(paymentMethod);
        OrderStatus initialStatus = isCod ? OrderStatus.CONFIRMED : OrderStatus.PENDING_PAYMENT;

        // 3. Build and persist order
        Order order = Order.builder()
                .user(user)
                .orderNumber(generateOrderNumber())
                .status(initialStatus)
                .subtotal(subtotal)
                .discountTotal(discountTotal)
                .couponCode(appliedCoupon)
                .couponDiscount(couponDiscount)
                .total(total)
                .paymentMethod(paymentMethod)
                .shippingName(request.getShippingName())
                .shippingPhone(request.getShippingPhone())
                .shippingAddress(request.getShippingAddress())
                .shippingCity(request.getShippingCity())
                .shippingState(request.getShippingState())
                .shippingPincode(request.getShippingPincode())
                .expiresAt(isCod ? null : LocalDateTime.now().plusMinutes(appProperties.getPayment().getWindowMinutes()))
                .estimatedShipDate(LocalDate.now().plusDays(1))
                .estimatedDeliveryDate(LocalDate.now().plusDays(4))
                .build();

        // Link items to order (bidirectional)
        orderItems.forEach(item -> item.setOrder(order));
        order.getItems().addAll(orderItems);

        // Add the initial status history entry manually
        order.getStatusHistory().add(
                com.ordermanagement.order.entity.OrderStatusHistory.builder()
                        .order(order)
                        .fromStatus(null)
                        .toStatus(initialStatus)
                        .note(isCod ? "Order confirmed (Cash on Delivery)" : "Order placed — awaiting payment")
                        .changedBy(user.getEmail())
                        .changedAt(LocalDateTime.now())
                        .build()
        );

        Order saved = orderRepository.save(order);

        // 4. Clear cart
        cartService.clearCart(user);

        log.info("Order {} placed by {} ({}) — total ₹{}", saved.getOrderNumber(),
                user.getEmail(), paymentMethod, total);

        // 5. Publish delay queue only for online unpaid orders; for COD send confirmation directly
        if (!isCod) {
            eventPublisher.publishEvent(new OrderPlacedEvent(saved.getId()));
        } else {
            eventPublisher.publishEvent(new OrderEventMessage(
                    "order.placed", saved.getId(), saved.getOrderNumber(),
                    user.getEmail(), user.getName(), saved.getTotal()
            ));
        }

        // In-app notification + RabbitMQ inventory & analytics events
        notifyUser(user, "Order " + saved.getOrderNumber() + " Placed",
                isCod ? "Your Cash on Delivery order is confirmed." : "Complete payment within 15 minutes to confirm your order.",
                "ORDER", "/orders/" + saved.getId());
        publishDomainEvent("inventory.updated", user.getEmail(), saved.getOrderNumber(),
                "Stock reserved for " + saved.getItems().size() + " item(s)");
        publishDomainEvent("analytics.order_created", user.getEmail(), saved.getOrderNumber(),
                "New order total INR " + saved.getTotal());

        // 7. Return with detail (includes items + history)
        return OrderResponse.detail(saved);
    }

    // ── Customer: my orders ───────────────────────────────────────────

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getMyOrders(User user, Pageable pageable) {
        Page<OrderResponse> page = orderRepository.findByUser(user, pageable)
                .map(OrderResponse::summary);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public OrderResponse getMyOrderById(User user, Long orderId) {
        Order order = orderRepository.findByIdAndUserWithDetails(orderId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
        return OrderResponse.detail(order);
    }

    // ── Customer: cancel ──────────────────────────────────────────────

    /**
     * Customer can cancel when: PENDING_PAYMENT or PAID (before shipping).
     * Stock is restored atomically for each item.
     */
    @Transactional
    public OrderResponse cancelOrder(User user, Long orderId) {
        Order order = orderRepository.findByIdAndUserWithDetails(orderId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        order.transitionTo(OrderStatus.CANCELLED, "Cancelled by customer", user.getEmail());
        restoreStock(order);
        orderRepository.save(order);

        log.info("Order {} cancelled by {}", order.getOrderNumber(), user.getEmail());

        // Publish cancellation event for email notification
        eventPublisher.publishEvent(new OrderEventMessage(
                "order.cancelled", order.getId(), order.getOrderNumber(),
                order.getUser().getEmail(), order.getUser().getName(), order.getTotal()
        ));

        return OrderResponse.detail(order);
    }

    // ── Admin: all orders ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getAllOrders(OrderStatus status, Pageable pageable) {
        Page<Order> page = (status != null)
                ? orderRepository.findByStatus(status, pageable)
                : orderRepository.findAll(pageable);
        return PagedResponse.from(page.map(OrderResponse::summary));
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long orderId) {
        Order order = orderRepository.findByIdWithDetails(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
        return OrderResponse.detail(order);
    }

    // ── Admin: status transition ──────────────────────────────────────

    /**
     * Admin drives the order through its lifecycle.
     * The state machine in Order.transitionTo() rejects illegal moves (409).
     */
    @Transactional
    public OrderResponse updateOrderStatus(Long orderId,
                                           UpdateOrderStatusRequest request,
                                           String adminEmail) {
        Order order = orderRepository.findByIdWithDetails(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        order.transitionTo(request.getStatus(), request.getNote(), adminEmail);

        // Update shipping & delivery timestamps and estimates
        if (request.getTrackingNumber() != null && !request.getTrackingNumber().isBlank()) {
            order.setTrackingNumber(request.getTrackingNumber().trim());
        }
        if (request.getCarrier() != null && !request.getCarrier().isBlank()) {
            order.setCarrier(request.getCarrier().trim());
        }
        if (request.getEstimatedDeliveryDate() != null) {
            order.setEstimatedDeliveryDate(request.getEstimatedDeliveryDate());
        }
        if (request.getStatus() == OrderStatus.SHIPPED) {
            order.setShippedAt(LocalDateTime.now());
            publishDomainEvent("shipment.created", adminEmail, order.getOrderNumber(),
                    "Shipped via " + (order.getCarrier() != null ? order.getCarrier() : "Standard Carrier"));
        } else if (request.getStatus() == OrderStatus.DELIVERED) {
            order.setDeliveredAt(LocalDateTime.now());
        }

        // Restore stock on admin-triggered cancellation
        if (request.getStatus() == OrderStatus.CANCELLED
                || request.getStatus() == OrderStatus.EXPIRED) {
            restoreStock(order);
            publishDomainEvent("inventory.updated", adminEmail, order.getOrderNumber(),
                    "Stock restored after " + request.getStatus());
        }

        orderRepository.save(order);
        auditLogService.record(adminEmail, "ORDER_STATUS_" + request.getStatus(), "ORDER",
                order.getOrderNumber(), request.getNote() != null ? request.getNote() : "Updated to " + request.getStatus());
        notifyUser(order.getUser(), "Order " + order.getOrderNumber() + " Updated",
                "Your order status is now " + request.getStatus().name().replace('_', ' ') + ".",
                "ORDER", "/orders/" + order.getId());
        log.info("Order {} → {} by admin {}", order.getOrderNumber(),
                request.getStatus(), adminEmail);

        // Publish notification event for email
        String routingKey = switch (request.getStatus()) {
            case SHIPPED   -> "order.shipped";
            case DELIVERED -> "order.delivered";
            case CANCELLED -> "order.cancelled";
            default        -> null;
        };
        if (routingKey != null) {
            eventPublisher.publishEvent(new OrderEventMessage(
                    routingKey, order.getId(), order.getOrderNumber(),
                    order.getUser().getEmail(), order.getUser().getName(), order.getTotal()
            ));
        }

        return OrderResponse.detail(order);
    }

    // ── Admin: delete order ───────────────────────────────────────────

    /**
     * Permanently deletes an order.
     * If the order is still PENDING_PAYMENT or PAID (stock was reserved),
     * stock is restored before deletion so inventory stays consistent.
     */
    @Transactional
    public void deleteOrder(Long orderId) {
        Order order = orderRepository.findByIdWithDetails(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        // Restore stock for active orders (stock was decremented on placement)
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT
                || order.getStatus() == OrderStatus.PAID
                || order.getStatus() == OrderStatus.SHIPPED) {
            restoreStock(order);
            log.info("Stock restored for deleted order {}", order.getOrderNumber());
        }

        // Delete payment records first to satisfy FK constraint (payments.order_id → orders.id)
        paymentRepository.deleteByOrder(order);

        orderRepository.delete(order);
        log.info("Order {} deleted by admin", order.getOrderNumber());
    }

    @Transactional(readOnly = true)
    public byte[] generateInvoiceForUser(User user, Long orderId) {
        Order order = orderRepository.findByIdAndUserWithDetails(orderId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
        return invoicePdfService.generateInvoice(order);
    }

    private void notifyUser(User user, String title, String message, String type, String link) {
        try {
            notificationRepository.save(InAppNotification.builder()
                    .user(user).title(title).message(message).type(type).link(link).build());
        } catch (Exception ex) {
            log.warn("Failed to create notification: {}", ex.getMessage());
        }
    }

    private void publishDomainEvent(String routingKey, String actor, String entityId, String details) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.ORDER_EVENTS_EXCHANGE, routingKey,
                    Map.of("actor", actor, "entityId", entityId, "details", details));
        } catch (Exception ex) {
            log.warn("Failed to publish RabbitMQ event {}: {}", routingKey, ex.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    /**
     * Restores stock for all items in an order.
     * Called on CANCELLED and EXPIRED transitions.
     */
    private void restoreStock(Order order) {
        for (OrderItem item : order.getItems()) {
            if (item.getProduct() != null) {
                productRepository.incrementStock(item.getProduct().getId(), item.getQuantity());
            }
        }
    }

    /**
     * Generates a collision-free order number using PostgreSQL sequence `order_number_seq`:
     * ORD-YYYYMMDD-NNNNNN — safe under arbitrarily high concurrent checkouts.
     */
    private String generateOrderNumber() {
        String datePart = LocalDateTime.now().format(ORDER_DATE_FMT);
        Number seq = (Number) entityManager
                .createNativeQuery("SELECT nextval('order_number_seq')")
                .getSingleResult();
        return "ORD-" + datePart + "-" + String.format("%06d", seq.longValue());
    }
}
