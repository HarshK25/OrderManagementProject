package com.ordermanagement.order.entity;

/**
 * Full order lifecycle.
 *
 * Legal transitions (enforced by the state-machine in Order entity):
 *   PENDING_PAYMENT  → PAID              (payment verified)
 *   PENDING_PAYMENT  → CANCELLED         (customer cancels before paying)
 *   PENDING_PAYMENT  → EXPIRED           (15-min window elapsed, RabbitMQ consumer)
 *   PAID             → SHIPPED           (admin action)
 *   PAID             → CANCELLED         (customer cancels before shipping)
 *   SHIPPED          → DELIVERED         (admin action)
 *   DELIVERED        → RETURN_REQUESTED  (customer requests return within 7 days)
 *   RETURN_REQUESTED → RETURN_APPROVED   (admin approves)
 *   RETURN_REQUESTED → RETURN_REJECTED   (admin rejects)
 *   RETURN_APPROVED  → PICKUP_COMPLETED  (admin marks item picked up)
 *   PICKUP_COMPLETED → REFUNDED          (Razorpay refund initiated)
 *
 * Stock is restored on CANCELLED and EXPIRED transitions only.
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    SHIPPED,
    DELIVERED,
    CANCELLED,
    EXPIRED,
    // --- Return & Refund workflow ---
    RETURN_REQUESTED,
    RETURN_APPROVED,
    RETURN_REJECTED,
    PICKUP_COMPLETED,
    REFUNDED
}
