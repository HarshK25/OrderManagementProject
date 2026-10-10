package com.ordermanagement.common.exception;

/** Thrown when a requested resource does not exist. Maps to HTTP 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }

    public ResourceNotFoundException(String resource, Long id) {
        super(resource + " not found with id: " + id);
    }

    public ResourceNotFoundException(String resource, String field, Object value) {
        super(resource + " not found with " + field + ": " + value);
    }
}
