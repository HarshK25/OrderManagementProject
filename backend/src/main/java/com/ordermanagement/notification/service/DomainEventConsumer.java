package com.ordermanagement.notification.service;

import com.ordermanagement.audit.service.AuditLogService;
import com.ordermanagement.config.RabbitMQConfig;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Map;

/**
 * Consumes domain events from the dedicated RabbitMQ queues:
 *  - payment.events.queue
 *  - inventory.events.queue
 *  - shipment.events.queue
 *  - analytics.events.queue
 *
 * Records structured audit logs and acknowledges each message cleanly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DomainEventConsumer {

    private final AuditLogService auditLogService;

    @RabbitListener(queues = {
            RabbitMQConfig.PAYMENT_EVENTS_QUEUE,
            RabbitMQConfig.INVENTORY_EVENTS_QUEUE,
            RabbitMQConfig.SHIPMENT_EVENTS_QUEUE,
            RabbitMQConfig.ANALYTICS_EVENTS_QUEUE
    }, containerFactory = "rabbitListenerContainerFactory")
    public void handleDomainEvent(Map<String, Object> payload,
                                  Channel channel,
                                  @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag,
                                  @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String routingKey) throws IOException {
        try {
            String entityId = payload != null && payload.get("entityId") != null
                    ? String.valueOf(payload.get("entityId")) : "-";
            String details = payload != null && payload.get("details") != null
                    ? String.valueOf(payload.get("details")) : routingKey;
            String actor = payload != null && payload.get("actor") != null
                    ? String.valueOf(payload.get("actor")) : "rabbitmq";

            log.info("RabbitMQ domain event [{}]: entityId={}, details={}", routingKey, entityId, details);
            auditLogService.record(actor, routingKey.toUpperCase(), "EVENT", entityId, details);
            channel.basicAck(deliveryTag, false);
        } catch (Exception ex) {
            log.error("Failed processing RabbitMQ event [{}]: {}", routingKey, ex.getMessage());
            channel.basicNack(deliveryTag, false, false);
        }
    }
}
