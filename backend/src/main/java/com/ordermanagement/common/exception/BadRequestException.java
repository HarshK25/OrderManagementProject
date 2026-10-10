package com.ordermanagement.common.exception;

/** Thrown when a request is syntactically valid but semantically wrong. Maps to HTTP 400. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
