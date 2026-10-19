package com.ordermanagement.payment.dto;

import java.math.BigDecimal;

/**
 * Response from POST /api/payments/create/{orderId}.
 * The frontend passes these values to the Razorpay Checkout popup.
 */
public record CreatePaymentResponse(
        String razorpayKeyId,
        String razorpayOrderId,
        BigDecimal amount,          // INR (not paise)
        String currency,
        String orderNumber
) {}
