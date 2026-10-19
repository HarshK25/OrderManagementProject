package com.ordermanagement.order.service;

import com.ordermanagement.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Publishes the order ID to the expiry delay queue AFTER the order transaction commits.
 *
 * Why AFTER_COMMIT?
 *   If we publish inside the transaction and then the transaction rolls back,
 *   a consumer could receive the message and try to expire an order that
 *   does not exist in the database yet (or never will).
 *   Publishing after commit guarantees the order row is visible to the consumer.
 *
 * The delay queue has no consumer — messages sit there until they expire
 * (TTL = payment window in minutes). When they expire, RabbitMQ dead-letters
 * them to the EXPIRY_DLX, which routes them to EXPIRY_PROCESS_QUEUE where
 * the {@link OrderExpiryConsumer} listens.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderExpiryPublisher {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Listen for {@link OrderPlacedEvent} and publish the order ID to the delay queue.
     * Spring fires this after the surrounding @Transactional method commits.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderPlaced(OrderPlacedEvent event) {
        Long orderId = event.orderId();
        rabbitTemplate.convertAndSend(
                "",                          // default exchange
                RabbitMQConfig.EXPIRY_DELAY_QUEUE,
                orderId
        );
        log.info("Published expiry message for order id={} to delay queue", orderId);
    }
}
