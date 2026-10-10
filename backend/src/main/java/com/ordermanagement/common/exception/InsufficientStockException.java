package com.ordermanagement.common.exception;

/**
 * Thrown when stock is insufficient to fulfil a cart or order request.
 * Maps to HTTP 409 — it's a conflict between requested quantity and available stock.
 *
 * Kept separate from ConflictException so callers can catch it specifically
 * and show a targeted message like "Only 2 units left in stock".
 */
public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String message) {
        super(message);
    }

    public InsufficientStockException(String productName, int requested, int available) {
        super("Insufficient stock for '" + productName
                + "': requested " + requested + ", available " + available);
    }
}
