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

    // ── Sheet-and-Biro Themed Auth & Account Emails ───────────────────

    public void sendRegistrationOtpEmail(String toEmail, String name, String otp) {
        String html = buildThemedAuthEmail(
                "EMAIL CONFIRMATION",
                "Confirm your ShopVerse account",
                "Hi " + escapeHtml(name) + ", enter the 6-digit verification code below to confirm your email address and activate your account.",
                otp,
                "This code expires in 10 minutes. If you didn't request an ShopVerse account, you can safely ignore this email."
        );
        sendHtmlEmail(toEmail, otp + " is your ShopVerse confirmation code", html);
    }

    public void sendWelcomeConfirmationEmail(String toEmail, String name) {
        String html = buildThemedWelcomeEmail(name);
        sendHtmlEmail(toEmail, "Welcome to ShopVerse — Account Confirmed", html);
    }

    public void sendPasswordResetOtpEmail(String toEmail, String name, String otp) {
        String html = buildThemedAuthEmail(
                "PASSWORD RESET",
                "Reset your ShopVerse password",
                "Hi " + escapeHtml(name) + ", we received a request to reset your password. Use the 6-digit security code below to choose a new password.",
                otp,
                "This code expires in 10 minutes. If you didn't request a password reset, you can safely ignore this email — your account stays secure."
        );
        sendHtmlEmail(toEmail, otp + " is your ShopVerse password reset code", html);
    }

    private void sendHtmlEmail(String toEmail, String subject, String htmlBody) {
        try {
            MimeMessage mimeMsg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMsg, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(mimeMsg);
            log.info("Themed email '{}' sent to {}", subject, toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send email '{}' to {}: {}", subject, toEmail, e.getMessage());
            throw new RuntimeException("Could not deliver email. Please verify your email address and try again.", e);
        }
    }

    /**
     * Sheet-and-Biro themed HTML email (#ffffff sheet, #f4f4f4 surface, #111111 ink, #1a4be0 accent).
     */
    private String buildThemedAuthEmail(String eyebrow, String heading, String bodyText, String otp, String footnote) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:32px 16px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
                          <tr>
                            <td style="height:4px;background-color:#1a4be0;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="padding:24px 32px 16px 32px;border-bottom:1px solid #e5e5e5;">
                              <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;background-color:#1a4be0;color:#ffffff;font-weight:700;font-size:13px;vertical-align:middle;margin-right:8px;">S</span>
                              <span style="font-size:18px;font-weight:700;letter-spacing:-0.03em;color:#111111;vertical-align:middle;">Shop<span style="color:#1a4be0;">Verse</span></span>
                              <span style="float:right;font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;letter-spacing:0.08em;color:#1a4be0;text-transform:uppercase;padding-top:4px;">%s</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:28px 32px;">
                              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.03em;color:#111111;">%s</h1>
                              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#6b6b6b;">%s</p>
                              <div style="background-color:#f4f4f4;border:1px solid #e5e5e5;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
                                <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6b6b6b;margin-bottom:8px;">Verification Code</div>
                                <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#1a4be0;">%s</div>
                              </div>
                              <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6b6b;">%s</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:18px 32px;background-color:#f4f4f4;border-top:1px solid #e5e5e5;font-size:11px;color:#6b6b6b;">
                              <span>ShopVerse &middot; Direct Store &amp; Order Operations</span><br/>
                              <span>Indiranagar, Bengaluru &middot; Automated security message</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(eyebrow, heading, bodyText, otp, footnote);
    }

    private String buildThemedWelcomeEmail(String name) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:32px 16px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
                          <tr><td style="height:4px;background-color:#1a4be0;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="padding:24px 32px 16px 32px;border-bottom:1px solid #e5e5e5;">
                              <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;background-color:#1a4be0;color:#ffffff;font-weight:700;font-size:13px;vertical-align:middle;margin-right:8px;">S</span>
                              <span style="font-size:18px;font-weight:700;letter-spacing:-0.03em;color:#111111;vertical-align:middle;">Shop<span style="color:#1a4be0;">Verse</span></span>
                              <span style="float:right;font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;letter-spacing:0.08em;color:#0f7d45;text-transform:uppercase;padding-top:4px;">ACCOUNT CONFIRMED</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:28px 32px;">
                              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.03em;color:#111111;">Welcome aboard, %s!</h1>
                              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#6b6b6b;">Your ShopVerse email has been verified and your account is ready. Browse 100+ stocked products, track every dispatch step, and download GST invoices anytime.</p>
                              <div style="background-color:#f4f4f4;border:1px solid #e5e5e5;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
                                <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b;">Welcome Offer</div>
                                <div style="font-size:15px;font-weight:600;color:#111111;margin-top:4px;">Use code <span style="font-family:'SFMono-Regular',Consolas,monospace;color:#1a4be0;">WELCOME10</span> for 10%% instant off your first order.</div>
                              </div>
                              <p style="margin:0;font-size:12px;color:#6b6b6b;">Need help? Contact support@ordermanagement.com or use the AI Shopping Assistant on the site.</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:18px 32px;background-color:#f4f4f4;border-top:1px solid #e5e5e5;font-size:11px;color:#6b6b6b;">
                              <span>ShopVerse &middot; Direct Store &amp; Order Operations</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(escapeHtml(name));
    }

    private String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
