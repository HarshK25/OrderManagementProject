package com.ordermanagement.order.service;

import com.ordermanagement.config.RabbitMQConfig;
import com.ordermanagement.notification.service.OrderEventMessage;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.product.repository.ProductRepository;
import com.rabbitmq.client.Channel;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

/**
 * Consumes messages from the order expiry process queue and expires unpaid orders.
 *
 * Idempotency design:
 *   1. Lock the order row with SELECT ... FOR UPDATE (pessimistic write lock).
 *      This serialises concurrent consumers and prevents double-expiry.
 *   2. Only transition if status is still PENDING_PAYMENT.
 *      If the order was already paid, cancelled, or expired, we do nothing.
 *   3. The unique razorpay_payment_id constraint in the payments table provides
 *      an additional guard against duplicate payment processing.
 *
 * On processing failure the message is nack'd without requeue, which sends it to
 * the poison DLQ (order.expiry.poison.queue) for manual inspection.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderExpiryConsumer {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final EntityManager entityManager;
    private final ApplicationEventPublisher eventPublisher;

    @RabbitListener(queues = RabbitMQConfig.EXPIRY_PROCESS_QUEUE,
                    containerFactory = "rabbitListenerContainerFactory")
    @Transactional
    public void handleExpiry(Long orderId,
                             Channel channel,
                             @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        log.info("Expiry consumer received orderId={}", orderId);
        try {
            processExpiry(orderId);
            channel.basicAck(deliveryTag, false);
            log.info("Expiry ack'd for orderId={}", orderId);
        } catch (Exception ex) {
            log.error("Expiry consumer failed for orderId={}, sending to poison queue", orderId, ex);
            // requeue=false → message goes to the poison DLQ via the queue's DLX
            channel.basicNack(deliveryTag, false, false);
        }
    }

    /**
     * Core idempotent expiry logic.
     *
     * Uses a PESSIMISTIC_WRITE lock so that if two copies of the same
     * expiry message arrive (e.g. after a broker restart), only one of them
     * will see PENDING_PAYMENT — the second will see EXPIRED and do nothing.
     */
    private void processExpiry(Long orderId) {
        // 1. Lock the row — blocks any concurrent expiry or payment for this order
        Order order = entityManager.find(Order.class, orderId, LockModeType.PESSIMISTIC_WRITE);

        if (order == null) {
            log.warn("Expiry consumer: order id={} not found — skipping", orderId);
            return;
        }

        // 2. Idempotency guard — only expire if still awaiting payment
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.info("Expiry consumer: order {} is already {} — no action taken",
                    order.getOrderNumber(), order.getStatus());
            return;
        }

        // 3. Transition to EXPIRED
        order.transitionTo(OrderStatus.EXPIRED, "Payment window elapsed (15-minute delay queue)", "system");

        // Mark any initiated payments for this order as EXPIRED
        entityManager.createQuery(
                "UPDATE Payment p SET p.status = com.ordermanagement.payment.entity.PaymentStatus.EXPIRED " +
                "WHERE p.order.id = :orderId AND p.status = com.ordermanagement.payment.entity.PaymentStatus.INITIATED")
                .setParameter("orderId", orderId)
                .executeUpdate();

        // 4. Restore stock atomically for each item
        order.getItems().forEach(item -> {
            if (item.getProduct() != null) {
                productRepository.incrementStock(item.getProduct().getId(), item.getQuantity());
                log.debug("Restored {} unit(s) of productId={} after order {} expired",
                        item.getQuantity(), item.getProduct().getId(), order.getOrderNumber());
            }
        });

        orderRepository.save(order);
        log.info("Order {} expired and stock restored", order.getOrderNumber());

        // Publish cancellation event — delay queue found order still PENDING_PAYMENT
        // (i.e. payment never arrived), so we treat it as a cancellation for
        // the customer: they receive an "Order Cancelled" email.
        eventPublisher.publishEvent(new OrderEventMessage(
                "order.cancelled", order.getId(), order.getOrderNumber(),
                order.getUser().getEmail(), order.getUser().getName(), order.getTotal()
        ));
    }
}
