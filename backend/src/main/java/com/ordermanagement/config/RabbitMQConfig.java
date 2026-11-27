package com.ordermanagement.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

/**
 * RabbitMQ topology for this application.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │                     ORDER EXPIRY FLOW                          │
 * │                                                                │
 * │  order.expiry.delay.queue  (TTL = paymentWindowMs, no consumer)│
 * │         ↓ (message expires → dead-lettered)                    │
 * │  order.expiry.dlx  (fanout DLX)                                │
 * │         ↓                                                       │
 * │  order.expiry.process.queue  ← ExpiryConsumer                  │
 * │         ↓ on failure (nack)                                     │
 * │  order.expiry.poison.queue   (DLQ for poison messages)          │
 * └────────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │                     EMAIL NOTIFICATION FLOW                    │
 * │                                                                │
 * │  order.events (topic exchange)                                 │
 * │    routing keys: order.placed, order.paid, order.shipped,      │
 * │                  order.delivered, order.cancelled, order.expired│
 * │         ↓                                                       │
 * │  order.email.queue  ← EmailConsumer                            │
 * │         ↓ on failure (header retry-count < 3)                   │
 * │  order.retry.10s.queue  (TTL 10s, DLX → order.events)          │
 * │         ↓ retry again, failure again                            │
 * │  order.retry.60s.queue  (TTL 60s, DLX → order.events)          │
 * │         ↓ retry exhausted (count == 3)                          │
 * │  order.events.dlq  (dead letter queue)                         │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Why queue-level TTL instead of per-message TTL?
 *   Queue TTL is applied uniformly and the broker evicts expired messages
 *   at the head of the queue — O(1) per eviction. Per-message TTL requires
 *   scanning the whole queue. Queue TTL also prevents message ordering issues
 *   that occur when short-lived messages are stuck behind long-lived ones
 *   when using per-message TTL.
 */
@Configuration
public class RabbitMQConfig {

    // ── Queue / Exchange names ────────────────────────────────────────

    // Expiry delay queue (no consumer, messages expire to DLX)
    public static final String EXPIRY_DELAY_QUEUE    = "order.expiry.delay.queue";
    // Dead-letter exchange that routes expired messages
    public static final String EXPIRY_DLX            = "order.expiry.dlx";
    // The queue where the real expiry consumer listens
    public static final String EXPIRY_PROCESS_QUEUE  = "order.expiry.process.queue";
    // DLQ for unprocessable expiry messages
    public static final String EXPIRY_POISON_QUEUE   = "order.expiry.poison.queue";
    // DLX for poison expiry messages (direct, bound to poison queue)
    public static final String EXPIRY_POISON_DLX     = "order.expiry.poison.dlx";

    // Email topic exchange
    public static final String ORDER_EVENTS_EXCHANGE = "order.events";
    // Email primary queue
    public static final String EMAIL_QUEUE           = "order.email.queue";
    // Email retry queues (bound back to the main exchange after TTL)
    public static final String RETRY_10S_QUEUE       = "order.retry.10s.queue";
    public static final String RETRY_60S_QUEUE       = "order.retry.60s.queue";
    // Email DLQ
    public static final String EMAIL_DLQ             = "order.events.dlq";
    // Email DLX (direct, bound to DLQ)
    public static final String EMAIL_DLX             = "order.events.dlx";

    // Routing key pattern for all order events
    public static final String ORDER_EVENTS_ROUTING_KEY = "order.*";

    // Domain event queues (Payment, Inventory, Shipment, Analytics/Refund)
    public static final String PAYMENT_EVENTS_QUEUE     = "payment.events.queue";
    public static final String INVENTORY_EVENTS_QUEUE   = "inventory.events.queue";
    public static final String SHIPMENT_EVENTS_QUEUE    = "shipment.events.queue";
    public static final String ANALYTICS_EVENTS_QUEUE   = "analytics.events.queue";

    // Header name used to track retry count
    public static final String RETRY_COUNT_HEADER    = "x-retry-count";

    // ── Message converter ─────────────────────────────────────────────

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        factory.setPrefetchCount(1);
        return factory;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ORDER EXPIRY TOPOLOGY
    // ═══════════════════════════════════════════════════════════════════

    /**
     * The dead-letter exchange that receives messages from the delay queue
     * once their TTL expires. It is a fanout so we don't need a routing key.
     */
    @Bean
    public FanoutExchange expiryDlx() {
        return new FanoutExchange(EXPIRY_DLX, true, false);
    }

    /**
     * Poison DLX — receives nack'd messages from the process queue.
     */
    @Bean
    public DirectExchange expiryPoisonDlx() {
        return new DirectExchange(EXPIRY_POISON_DLX, true, false);
    }

    /**
     * The delay queue.
     *  - x-message-ttl         : set at runtime from app.payment.window-minutes
     *    (we use a per-queue TTL declared once; the OrderExpiryPublisher
     *     sets the TTL in the queue args via the declarable bean below)
     *  - x-dead-letter-exchange : EXPIRY_DLX
     *
     * There are NO consumers on this queue — messages sit here until they expire.
     *
     * NOTE: The actual TTL is set via the queueArgs map below so it can be
     *       driven from configuration. The bean is created with a long TTL
     *       (15 min = 900 000 ms). For testing, override PAYMENT_WINDOW_MINUTES=1.
     *       Because Spring AMQP declares the queue if it doesn't exist, changing
     *       TTL requires deleting and re-creating the queue (or using a new queue name).
     */
    @Bean
    public Queue expiryDelayQueue(AppProperties props) {
        long ttlMs = (long) props.getPayment().getWindowMinutes() * 60 * 1000;
        Map<String, Object> args = new HashMap<>();
        args.put("x-message-ttl", ttlMs);
        args.put("x-dead-letter-exchange", EXPIRY_DLX);
        return new Queue(EXPIRY_DELAY_QUEUE, true, false, false, args);
    }

    /**
     * The queue where the expiry consumer actually listens.
     * On failure, messages are sent to the poison DLX.
     */
    @Bean
    public Queue expiryProcessQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EXPIRY_POISON_DLX);
        args.put("x-dead-letter-routing-key", EXPIRY_POISON_QUEUE);
        return new Queue(EXPIRY_PROCESS_QUEUE, true, false, false, args);
    }

    @Bean
    public Queue expiryPoisonQueue() {
        return new Queue(EXPIRY_POISON_QUEUE, true);
    }

    @Bean
    public Binding expiryPoisonBinding() {
        return BindingBuilder.bind(expiryPoisonQueue())
                .to(expiryPoisonDlx())
                .with(EXPIRY_POISON_QUEUE);
    }

    /** Route expired messages from DLX to the process queue. */
    @Bean
    public Binding expiryProcessBinding() {
        return BindingBuilder.bind(expiryProcessQueue()).to(expiryDlx());
    }

    // ═══════════════════════════════════════════════════════════════════
    // EMAIL NOTIFICATION TOPOLOGY
    // ═══════════════════════════════════════════════════════════════════

    /** Topic exchange — all order lifecycle events go here. */
    @Bean
    public TopicExchange orderEventsExchange() {
        return new TopicExchange(ORDER_EVENTS_EXCHANGE, true, false);
    }

    /** Direct exchange for email DLQ routing. */
    @Bean
    public DirectExchange emailDlx() {
        return new DirectExchange(EMAIL_DLX, true, false);
    }

    /** Email DLQ — messages land here after retry exhaustion. */
    @Bean
    public Queue emailDlq() {
        return new Queue(EMAIL_DLQ, true);
    }

    @Bean
    public Binding emailDlqBinding() {
        return BindingBuilder.bind(emailDlq()).to(emailDlx()).with(EMAIL_DLQ);
    }

    /**
     * Primary email queue.
     * On nack after retry exhaustion → EMAIL_DLX → EMAIL_DLQ.
     */
    @Bean
    public Queue emailQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EMAIL_DLX);
        args.put("x-dead-letter-routing-key", EMAIL_DLQ);
        return new Queue(EMAIL_QUEUE, true, false, false, args);
    }

    /** Bind email queue to topic exchange with wildcard pattern. */
    @Bean
    public Binding emailQueueBinding() {
        return BindingBuilder.bind(emailQueue())
                .to(orderEventsExchange())
                .with(ORDER_EVENTS_ROUTING_KEY);
    }

    /**
     * 10-second retry queue.
     * Messages expire after 10s and are dead-lettered back to order.events exchange.
     */
    @Bean
    public Queue retry10sQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-message-ttl", 10_000L);
        args.put("x-dead-letter-exchange", ORDER_EVENTS_EXCHANGE);
        return new Queue(RETRY_10S_QUEUE, true, false, false, args);
    }

    /**
     * 60-second retry queue.
     * Messages expire after 60s and are dead-lettered back to order.events exchange.
     */
    @Bean
    public Queue retry60sQueue() {
        Map<String, Object> args = new HashMap<>();
        args.put("x-message-ttl", 60_000L);
        args.put("x-dead-letter-exchange", ORDER_EVENTS_EXCHANGE);
        return new Queue(RETRY_60S_QUEUE, true, false, false, args);
    }

    // ═══════════════════════════════════════════════════════════════════
    // DOMAIN EVENT QUEUES (Payment, Inventory, Shipment, Analytics/Refund)
    // ═══════════════════════════════════════════════════════════════════

    private Queue durableQueueWithDlq(String name) {
        Map<String, Object> args = new HashMap<>();
        args.put("x-dead-letter-exchange", EMAIL_DLX);
        args.put("x-dead-letter-routing-key", EMAIL_DLQ);
        return new Queue(name, true, false, false, args);
    }

    @Bean public Queue paymentEventsQueue()   { return durableQueueWithDlq(PAYMENT_EVENTS_QUEUE); }
    @Bean public Queue inventoryEventsQueue() { return durableQueueWithDlq(INVENTORY_EVENTS_QUEUE); }
    @Bean public Queue shipmentEventsQueue()  { return durableQueueWithDlq(SHIPMENT_EVENTS_QUEUE); }
    @Bean public Queue analyticsEventsQueue() { return durableQueueWithDlq(ANALYTICS_EVENTS_QUEUE); }

    @Bean
    public Binding paymentEventsBinding() {
        return BindingBuilder.bind(paymentEventsQueue()).to(orderEventsExchange()).with("payment.*");
    }

    @Bean
    public Binding inventoryEventsBinding() {
        return BindingBuilder.bind(inventoryEventsQueue()).to(orderEventsExchange()).with("inventory.*");
    }

    @Bean
    public Binding shipmentEventsBinding() {
        return BindingBuilder.bind(shipmentEventsQueue()).to(orderEventsExchange()).with("shipment.*");
    }

    @Bean
    public Binding analyticsEventsBinding() {
        return BindingBuilder.bind(analyticsEventsQueue()).to(orderEventsExchange()).with("analytics.*");
    }

    @Bean
    public Binding refundEventsBinding() {
        return BindingBuilder.bind(analyticsEventsQueue()).to(orderEventsExchange()).with("refund.*");
    }
}
