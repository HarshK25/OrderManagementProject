package com.ordermanagement.order.entity;

import com.ordermanagement.common.entity.BaseEntity;
import com.ordermanagement.common.exception.InvalidStateTransitionException;
import com.ordermanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Core order aggregate.
 *
 * Relationship choices:
 *  - items and statusHistory are LAZY — we join them only when needed.
 *  - user is LAZY — we only need the user's ID for most order queries.
 *
 * State machine:
 *  All status changes go through {@link #transitionTo(OrderStatus, String, String)}.
 *  Illegal transitions throw {@link InvalidStateTransitionException} (409).
 *  Every transition also writes a row to statusHistory so the timeline is complete.
 *
 * Naming: "Order" is fine as a Java class name; @Table(name = "orders") maps it
 * to the correct table since "order" is a SQL reserved word.
 */
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order extends BaseEntity {

    /** Allowed transitions: from-status → set of valid to-statuses */
    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS =
            new EnumMap<>(OrderStatus.class);

    static {
        TRANSITIONS.put(OrderStatus.PENDING_PAYMENT, Set.of(
                OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.EXPIRED));
        TRANSITIONS.put(OrderStatus.PAID, Set.of(
                OrderStatus.SHIPPED, OrderStatus.CANCELLED));
        TRANSITIONS.put(OrderStatus.SHIPPED, Set.of(
                OrderStatus.DELIVERED));
        TRANSITIONS.put(OrderStatus.DELIVERED, Set.of(
                OrderStatus.RETURN_REQUESTED));
        TRANSITIONS.put(OrderStatus.CANCELLED, Set.of());
        TRANSITIONS.put(OrderStatus.EXPIRED, Set.of());
        // ── Return & Refund workflow ──────────────────────────────────────
        TRANSITIONS.put(OrderStatus.RETURN_REQUESTED, Set.of(
                OrderStatus.RETURN_APPROVED, OrderStatus.RETURN_REJECTED));
        TRANSITIONS.put(OrderStatus.RETURN_APPROVED, Set.of(
                OrderStatus.PICKUP_COMPLETED));
        TRANSITIONS.put(OrderStatus.PICKUP_COMPLETED, Set.of(
                OrderStatus.REFUNDED));
        TRANSITIONS.put(OrderStatus.RETURN_REJECTED, Set.of());
        TRANSITIONS.put(OrderStatus.REFUNDED, Set.of());
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_total", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discountTotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    // ── Shipping address snapshot (captured at checkout, never changes) ──
    @Column(name = "shipping_name",    nullable = false, length = 100)
    private String shippingName;

    @Column(name = "shipping_phone",   nullable = false, length = 20)
    private String shippingPhone;

    @Column(name = "shipping_address", nullable = false, length = 500)
    private String shippingAddress;

    @Column(name = "shipping_city",    nullable = false, length = 100)
    private String shippingCity;

    @Column(name = "shipping_state",   nullable = false, length = 100)
    private String shippingState;

    @Column(name = "shipping_pincode", nullable = false, length = 10)
    private String shippingPincode;

    /** Payment deadline — null after PAID/CANCELLED/EXPIRED. */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /** Estimated date of dispatch (e.g. today + 1 day) */
    @Column(name = "estimated_ship_date")
    private java.time.LocalDate estimatedShipDate;

    /** Estimated date of delivery (e.g. today + 4 days, or admin override) */
    @Column(name = "estimated_delivery_date")
    private java.time.LocalDate estimatedDeliveryDate;

    /** Exact timestamp when order was marked SHIPPED */
    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    /** Exact timestamp when order was marked DELIVERED */
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL,
               orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL,
               orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("changedAt ASC")
    @Builder.Default
    private List<OrderStatusHistory> statusHistory = new ArrayList<>();

    // ── State machine ────────────────────────────────────────────────

    /**
     * The only method that changes order status.
     * Validates the transition, updates status, and appends a history row.
     *
     * @param to        target status
     * @param note      human-readable reason (optional)
     * @param changedBy email or "system" of whoever triggered the change
     */
    public void transitionTo(OrderStatus to, String note, String changedBy) {
        Set<OrderStatus> allowed = TRANSITIONS.getOrDefault(this.status, Set.of());
        if (!allowed.contains(to)) {
            throw new InvalidStateTransitionException(
                    "Order " + orderNumber + ": cannot transition from " + this.status + " to " + to);
        }
        OrderStatus from = this.status;
        this.status = to;

        OrderStatusHistory history = OrderStatusHistory.builder()
                .order(this)
                .fromStatus(from)
                .toStatus(to)
                .note(note)
                .changedBy(changedBy)
                .changedAt(LocalDateTime.now())
                .build();
        this.statusHistory.add(history);
    }
}
