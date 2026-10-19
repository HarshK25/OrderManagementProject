package com.ordermanagement.payment.dto;

/**
 * Simple response for POST /api/payments/verify.
 */
public record PaymentVerifyResponse(boolean success, String message) {}
