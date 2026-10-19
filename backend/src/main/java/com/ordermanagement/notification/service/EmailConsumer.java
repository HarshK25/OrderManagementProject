package com.ordermanagement.notification.service;

import com.ordermanagement.config.RabbitMQConfig;
import com.ordermanagement.notification.entity.ProcessedEvent;
import com.ordermanagement.notification.repository.ProcessedEventRepository;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

/**
 * Consumes order lifecycle events from the email queue and sends HTML emails.
 *
 * Retry design (3-attempt maximum):
 *   Attempt 1 — fails → route to retry.10s queue (10-second delay)
 *   Attempt 2 — fails → route to retry.60s queue (60-second delay)
 *   Attempt 3 — fails → nack to email DLQ for manual inspection
 *
 * Each retry queue has x-dead-letter-exchange pointing back to order.events,
 * so when TTL expires the message is re-delivered to the email queue.
 *
 * Idempotency:
 *   Before sending, we try to insert a row into processed_events.
 *   If the insert fails with a unique violation, the event was already processed
 *   and we ack silently. The event_id format is "routingKey:orderId:attemptNumber".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailConsumer {

    private static final int MAX_RETRIES = 3;

    private final EmailService emailService;
    private final ProcessedEventRepository processedEventRepo;
    private final RabbitTemplate rabbitTemplate;

    @RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE,
                    containerFactory = "rabbitListenerContainerFactory")
    @Transactional
    public void handleOrderEvent(OrderEventMessage event,
                                 Message message,
                                 Channel channel,
                                 @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        int retryCount = getRetryCount(message);
        String eventId = event.routingKey() + ":" + event.orderId() + ":" + retryCount;

        log.info("Email consumer received event={} for order={} attempt={}",
                event.routingKey(), event.orderNumber(), retryCount);

        try {
            // Idempotency check — insert atomically
            processedEventRepo.save(
                    ProcessedEvent.builder().eventId(eventId).build()
            );
        } catch (DataIntegrityViolationException e) {
            log.info("Event {} already processed — acking and skipping", eventId);
            channel.basicAck(deliveryTag, false);
            return;
        }

        try {
            emailService.sendOrderEmail(event);
            channel.basicAck(deliveryTag, false);
            log.info("Email sent for event={} order={}", event.routingKey(), event.orderNumber());

        } catch (Exception ex) {
            log.error("Email send failed for event={} order={} attempt={}: {}",
                    event.routingKey(), event.orderNumber(), retryCount, ex.getMessage());

            if (retryCount < MAX_RETRIES - 1) {
                // Route to the appropriate retry queue
                routeToRetry(event, message, retryCount);
                channel.basicAck(deliveryTag, false); // ack original; retry queue re-delivers later
            } else {
                // Exhausted retries → nack to DLQ
                log.error("Max retries exhausted for event={} order={} — sending to DLQ",
                        event.routingKey(), event.orderNumber());
                channel.basicNack(deliveryTag, false, false);
            }
        }
    }

    private void routeToRetry(OrderEventMessage event, Message originalMessage, int currentRetry) {
        String retryQueue = (currentRetry == 0)
                ? RabbitMQConfig.RETRY_10S_QUEUE
                : RabbitMQConfig.RETRY_60S_QUEUE;

        MessageProperties props = new MessageProperties();
        props.setHeader(RabbitMQConfig.RETRY_COUNT_HEADER, currentRetry + 1);
        // Preserve the original routing key so re-delivery goes to the correct queue
        props.setHeader("x-original-routing-key", originalMessage.getMessageProperties().getReceivedRoutingKey());

        Message retryMessage = new Message(originalMessage.getBody(), props);

        // Send directly to the retry queue (default exchange, queue name as routing key)
        rabbitTemplate.send("", retryQueue, retryMessage);
        log.info("Routed to {} (attempt {})", retryQueue, currentRetry + 1);
    }

    private int getRetryCount(Message message) {
        Object header = message.getMessageProperties().getHeader(RabbitMQConfig.RETRY_COUNT_HEADER);
        if (header instanceof Integer i) return i;
        if (header instanceof Long l) return l.intValue();
        return 0;
    }
}
