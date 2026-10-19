package com.ordermanagement.notification.service;

import java.math.BigDecimal;

/**
 * Serializable payload published to the order.events topic exchange.
 * All fields are primitives/Strings for safe JSON serialisation.
 *
 * routingKey must start with "order." to match the email queue binding.
 * Examples: "order.placed", "order.paid", "order.shipped", "order.delivered",
 *           "order.cancelled", "order.expired"
 */
public record OrderEventMessage(
        String routingKey,
        Long orderId,
        String orderNumber,
        String customerEmail,
        String customerName,
        BigDecimal total
) {}
