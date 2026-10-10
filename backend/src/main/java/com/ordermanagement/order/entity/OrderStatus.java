package com.ordermanagement.order.entity;

/**
 * Full order lifecycle.
 *
 * Legal transitions (enforced by the state-machine in Order entity):
 *   PENDING_PAYMENT → PAID         (payment verified)
 *   PENDING_PAYMENT → CANCELLED    (customer cancels before paying)
 *   PENDING_PAYMENT → EXPIRED      (15-min window elapsed, RabbitMQ consumer)
 *   PAID            → SHIPPED      (admin action)
 *   PAID            → CANCELLED    (customer cancels before shipping)
 *   SHIPPED         → DELIVERED    (admin action)
 *
 * Stock is restored on CANCELLED and EXPIRED transitions.
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    SHIPPED,
    DELIVERED,
    CANCELLED,
    EXPIRED
}
