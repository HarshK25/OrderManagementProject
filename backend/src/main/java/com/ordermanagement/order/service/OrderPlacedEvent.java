package com.ordermanagement.order.service;

/**
 * Domain event fired after an order is successfully placed.
 * The publisher uses Spring's @TransactionalEventListener so it fires
 * only AFTER the transaction commits — guaranteeing the order row exists
 * in the database before any consumer can try to process it.
 *
 * @param orderId the persisted order ID
 */
public record OrderPlacedEvent(Long orderId) {}
