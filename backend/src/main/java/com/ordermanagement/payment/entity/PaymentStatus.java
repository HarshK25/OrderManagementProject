package com.ordermanagement.payment.entity;

/**
 * Payment record status.
 * A payment starts as CREATED when we request a Razorpay order,
 * moves to SUCCESS after signature verification, or FAILED on error.
 */
public enum PaymentStatus {
    CREATED,
    SUCCESS,
    FAILED
}
