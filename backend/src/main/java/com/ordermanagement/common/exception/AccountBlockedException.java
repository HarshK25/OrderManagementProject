package com.ordermanagement.common.exception;

/**
 * Thrown when a BLOCKED user attempts to access a protected resource.
 * Maps to HTTP 403 — authenticated but not authorized because the account is blocked.
 *
 * This is separate from Spring Security's AccessDeniedException so the error code
 * can be "ACCOUNT_BLOCKED" rather than the generic "ACCESS_DENIED".
 */
public class AccountBlockedException extends RuntimeException {
    public AccountBlockedException(String email) {
        super("Account is blocked: " + email);
    }
}
