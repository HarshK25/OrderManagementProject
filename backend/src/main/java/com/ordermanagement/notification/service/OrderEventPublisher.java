package com.ordermanagement.notification.service;

import com.ordermanagement.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Publishes order lifecycle events to the topic exchange AFTER COMMIT.
 *
 * Publishing after commit ensures:
 *  - The order row is committed and visible before the email consumer reads it.
 *  - If the transaction rolls back, no email is sent for a non-existent state change.
 *
 * Other services fire Spring ApplicationEvents (subclasses / instances of
 * OrderEventMessage wrapped in a generic Spring event), and this publisher
 * listens and forwards them to RabbitMQ.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderEvent(OrderEventMessage event) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ORDER_EVENTS_EXCHANGE,
                event.routingKey(),
                event
        );
        log.info("Published {} event for order {}", event.routingKey(), event.orderNumber());
    }
}
