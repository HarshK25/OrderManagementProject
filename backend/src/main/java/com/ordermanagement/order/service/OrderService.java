package com.ordermanagement.order.service;

import com.ordermanagement.cart.entity.Cart;
import com.ordermanagement.cart.entity.CartItem;
import com.ordermanagement.cart.service.CartService;
import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.InsufficientStockException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.config.AppProperties;
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

        // Re-fetch with products to ensure stock data is fresh
        List<CartItem> cartItems = cart.getItems();

        // 2. Atomically decrement stock for every cart item
        //    The whole operation is inside one @Transactional so any failure
        //    rolls back ALL decrements already applied.
        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discountTotal = BigDecimal.ZERO;

        for (CartItem cartItem : cartItems) {
            Product product = cartItem.getProduct();
            int qty = cartItem.getQuantity();

            int rowsUpdated = productRepository.decrementStockIfAvailable(product.getId(), qty);
            if (rowsUpdated == 0) {
                // Fetch fresh stock to report accurate available quantity
                Product fresh = productRepository.findById(product.getId()).orElseThrow();
                throw new InsufficientStockException(fresh.getName(), qty, fresh.getStock());
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

        // 3. Build and persist order
        Order order = Order.builder()
                .user(user)
                .orderNumber(generateOrderNumber())
                .status(OrderStatus.PENDING_PAYMENT)
                .subtotal(subtotal)
                .discountTotal(discountTotal)
                .total(total)
                .shippingName(request.getShippingName())
                .shippingPhone(request.getShippingPhone())
                .shippingAddress(request.getShippingAddress())
                .shippingCity(request.getShippingCity())
                .shippingState(request.getShippingState())
                .shippingPincode(request.getShippingPincode())
                .expiresAt(LocalDateTime.now().plusMinutes(appProperties.getPayment().getWindowMinutes()))
                .estimatedShipDate(LocalDate.now().plusDays(1))
                .estimatedDeliveryDate(LocalDate.now().plusDays(4))
                .build();

        // Link items to order (bidirectional)
        orderItems.forEach(item -> item.setOrder(order));
        order.getItems().addAll(orderItems);

        // Add the initial PENDING_PAYMENT status history entry manually
        // (transitionTo() requires a from-status; placement is the genesis)
        order.getStatusHistory().add(
                com.ordermanagement.order.entity.OrderStatusHistory.builder()
                        .order(order)
                        .fromStatus(null)
                        .toStatus(OrderStatus.PENDING_PAYMENT)
                        .note("Order placed")
                        .changedBy(user.getEmail())
                        .changedAt(LocalDateTime.now())
                        .build()
        );

        Order saved = orderRepository.save(order);

        // 4. Clear cart
        cartService.clearCart(user);

        log.info("Order {} placed by {} — total ₹{}", saved.getOrderNumber(),
                user.getEmail(), total);

        // 5. Publish domain event — fires AFTER_COMMIT via @TransactionalEventListener
        //    so the delay-queue message is only sent once the order row is visible
        //    to the expiry consumer.
        eventPublisher.publishEvent(new OrderPlacedEvent(saved.getId()));

        // NOTE: No order.placed email is sent here.
        // Email is sent only after successful payment via order.paid event in PaymentService.

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
        if (request.getStatus() == OrderStatus.SHIPPED) {
            order.setShippedAt(LocalDateTime.now());
            if (request.getEstimatedDeliveryDate() != null) {
                order.setEstimatedDeliveryDate(request.getEstimatedDeliveryDate());
            }
        } else if (request.getStatus() == OrderStatus.DELIVERED) {
            order.setDeliveredAt(LocalDateTime.now());
        }

        // Restore stock on admin-triggered cancellation
        if (request.getStatus() == OrderStatus.CANCELLED
                || request.getStatus() == OrderStatus.EXPIRED) {
            restoreStock(order);
        }

        orderRepository.save(order);
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
     * Generates a unique order number: ORD-YYYYMMDD-NNNN
     * e.g. ORD-20241015-0001
     * Not perfectly collision-safe for massive concurrent load, but
     * the DB UNIQUE constraint on order_number is the safety net.
     */
    private String generateOrderNumber() {
        String datePart = LocalDateTime.now().format(ORDER_DATE_FMT);
        String prefix = "ORD-" + datePart + "-";
        long count = orderRepository.countByOrderNumberStartingWith(prefix);
        return prefix + String.format("%04d", count + 1);
    }
}
