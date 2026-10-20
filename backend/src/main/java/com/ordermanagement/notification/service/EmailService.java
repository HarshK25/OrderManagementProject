package com.ordermanagement.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Map;

/**
 * Sends HTML emails using Thymeleaf templates and Gmail SMTP.
 *
 * Templates live in: src/main/resources/templates/email/
 * Each event type maps to a template: order-placed.html, order-paid.html, etc.
 *
 * The actual sending is synchronous here — the async decoupling is achieved
 * by the RabbitMQ queue. The @RabbitListener thread pool handles concurrency.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    private static final Map<String, String> SUBJECT_MAP = Map.of(
            "order.placed",    "Order Placed — Your order has been received!",
            "order.paid",      "Payment Confirmed — Your order is confirmed!",
            "order.shipped",   "Your Order Has Been Shipped!",
            "order.delivered", "Order Delivered — Thank you for shopping with us!",
            "order.cancelled", "Order Cancelled",
            "order.expired",   "Order Expired — Payment Window Closed"
    );

    private static final Map<String, String> TEMPLATE_MAP = Map.of(
            "order.placed",    "email/order-placed",
            "order.paid",      "email/order-paid",
            "order.shipped",   "email/order-shipped",
            "order.delivered", "email/order-delivered",
            "order.cancelled", "email/order-cancelled",
            "order.expired",   "email/order-expired"
    );

    /**
     * Resolves the template and subject from the event routing key, renders
     * the Thymeleaf template and sends the email.
     *
     * @throws IllegalArgumentException if the routing key is unknown
     * @throws RuntimeException wrapping MessagingException on SMTP failure
     */
    public void sendOrderEmail(OrderEventMessage event) {
        String templateName = TEMPLATE_MAP.get(event.routingKey());
        String subject      = SUBJECT_MAP.get(event.routingKey());

        if (templateName == null) {
            log.warn("Unknown event routing key: {} — no email sent", event.routingKey());
            return;
        }

        Context ctx = new Context();
        ctx.setVariable("customerName",  event.customerName());
        ctx.setVariable("orderNumber",   event.orderNumber());
        ctx.setVariable("total",         event.total());
        ctx.setVariable("routingKey",    event.routingKey());

        String htmlBody = templateEngine.process(templateName, ctx);

        try {
            MimeMessage mimeMsg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMsg, "UTF-8");
            helper.setTo(event.customerEmail());
            helper.setSubject(subject + " [" + event.orderNumber() + "]");
            helper.setText(htmlBody, true);

            mailSender.send(mimeMsg);
            log.info("Email sent: subject='{}' to={}", subject, event.customerEmail());
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send email for order " + event.orderNumber(), e);
        }
    }
}
