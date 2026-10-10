package com.ordermanagement.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Unified error response envelope returned by every exception handler.
 *
 * Fields:
 *  timestamp   — when the error occurred (ISO-8601)
 *  status      — HTTP status code (e.g. 400, 404, 409)
 *  code        — machine-readable error code (e.g. "VALIDATION_ERROR")
 *  message     — human-readable summary
 *  path        — request URI that caused the error
 *  fieldErrors — populated only for validation errors; null otherwise
 *
 * @JsonInclude(NON_NULL) suppresses null fields so the client doesn't see
 * "fieldErrors: null" on non-validation errors.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    private int status;
    private String code;
    private String message;
    private String path;

    /** Non-null only for 400 validation errors. */
    private List<FieldErrorDetail> fieldErrors;

    // ── Nested DTO ───────────────────────────────────────────────────
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class FieldErrorDetail {
        /** JSON field name that failed validation (e.g. "email"). */
        private String field;
        /** Constraint message (e.g. "must not be blank"). */
        private String message;
    }

    // ── Factory helpers ──────────────────────────────────────────────

    public static ErrorResponse of(int status, String code, String message, String path) {
        return ErrorResponse.builder()
                .status(status)
                .code(code)
                .message(message)
                .path(path)
                .build();
    }
}
