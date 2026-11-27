package com.ordermanagement.payment.entity;

/**
 * Payment record status.
 * A payment starts as CREATED when we request a Razorpay order,
 * moves to SUCCESS after signature verification, or FAILED on error.
 */
public enum PaymentStatus {
    INITIATED,  // Razorpay order created or COD pending, awaiting payment
    SUCCESS,    // Signature verified or COD collected, order marked PAID
    FAILED,     // Verification failed
    EXPIRED,    // 15-minute payment window elapsed
    REFUNDED    // Refund processed
}
