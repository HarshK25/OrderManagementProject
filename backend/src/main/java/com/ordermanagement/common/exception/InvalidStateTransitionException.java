package com.ordermanagement.common.exception;

/**
 * Thrown when an order status transition is not permitted by the state machine.
 * Example: trying to move an EXPIRED order to PAID.
 * Maps to HTTP 409 — handled centrally by GlobalExceptionHandler.
 */
public class InvalidStateTransitionException extends RuntimeException {
    public InvalidStateTransitionException(String message) {
        super(message);
    }
}
