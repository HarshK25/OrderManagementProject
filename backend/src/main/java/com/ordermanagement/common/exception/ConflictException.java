package com.ordermanagement.common.exception;

/**
 * Thrown when an operation conflicts with the current state of a resource.
 * Examples: duplicate email on register, duplicate category name. Maps to HTTP 409.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
