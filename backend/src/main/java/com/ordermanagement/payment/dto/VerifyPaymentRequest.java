package com.ordermanagement.payment.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for POST /api/payments/verify.
 * All three fields come back from the Razorpay Checkout popup callback.
 */
public record VerifyPaymentRequest(
        @NotBlank String razorpayOrderId,
        @NotBlank String razorpayPaymentId,
        @NotBlank String razorpaySignature
) {}
