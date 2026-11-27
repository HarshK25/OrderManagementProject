package com.ordermanagement.common.exception;

import com.ordermanagement.common.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

/**
 * Central exception handler — every exception that can occur in a controller
 * ends up here and is translated into a consistent {@link ErrorResponse} JSON.
 *
 * HTTP status → error code mapping:
 * ┌──────────────────────────────────────────────────┬──────┬────────────────────────────┐
 * │ Exception                                        │ HTTP │ code                       │
 * ├──────────────────────────────────────────────────┼──────┼────────────────────────────┤
 * │ MethodArgumentNotValidException                  │ 400  │ VALIDATION_ERROR           │
 * │ ConstraintViolationException                     │ 400  │ VALIDATION_ERROR           │
 * │ HttpMessageNotReadableException                  │ 400  │ MALFORMED_REQUEST          │
 * │ MethodArgumentTypeMismatchException              │ 400  │ BAD_REQUEST                │
 * │ BadRequestException                              │ 400  │ BAD_REQUEST                │
 * │ AuthenticationException                          │ 401  │ UNAUTHORIZED               │
 * │ AccountBlockedException                          │ 403  │ ACCOUNT_BLOCKED            │
 * │ AccessDeniedException                            │ 403  │ ACCESS_DENIED              │
 * │ ResourceNotFoundException                        │ 404  │ RESOURCE_NOT_FOUND         │
 * │ HttpRequestMethodNotSupportedException           │ 405  │ METHOD_NOT_ALLOWED         │
 * │ ConflictException                                │ 409  │ CONFLICT                   │
 * │ InsufficientStockException                       │ 409  │ INSUFFICIENT_STOCK         │
 * │ InvalidStateTransitionException                  │ 409  │ INVALID_STATE_TRANSITION   │
 * │ Exception (catch-all)                            │ 500  │ INTERNAL_ERROR             │
 * └──────────────────────────────────────────────────┴──────┴────────────────────────────┘
 *
 * Security note: The catch-all handler logs the full stack trace internally
 * but NEVER exposes it in the response — clients only see a generic 500 message.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ── 400 Validation (Bean Validation on @RequestBody) ─────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        List<ErrorResponse.FieldErrorDetail> fieldErrors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> new ErrorResponse.FieldErrorDetail(
                        fe.getField(),
                        fe.getDefaultMessage()))
                .toList();

        ErrorResponse body = ErrorResponse.builder()
                .status(400)
                .code("VALIDATION_ERROR")
                .message("Validation failed for one or more fields")
                .path(request.getRequestURI())
                .fieldErrors(fieldErrors)
                .build();

        return ResponseEntity.badRequest().body(body);
    }

    // ── 400 Validation (Bean Validation on @RequestParam / @PathVariable) ──

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest request) {

        List<ErrorResponse.FieldErrorDetail> fieldErrors = ex.getConstraintViolations()
                .stream()
                .map(cv -> {
                    // Strip the method prefix from the property path (e.g. "getProduct.id" → "id")
                    String path = cv.getPropertyPath().toString();
                    String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
                    return new ErrorResponse.FieldErrorDetail(field, cv.getMessage());
                })
                .toList();

        ErrorResponse body = ErrorResponse.builder()
                .status(400)
                .code("VALIDATION_ERROR")
                .message("Validation failed")
                .path(request.getRequestURI())
                .fieldErrors(fieldErrors)
                .build();

        return ResponseEntity.badRequest().body(body);
    }

    // ── 400 Malformed JSON body ───────────────────────────────────────

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleNotReadable(
            HttpMessageNotReadableException ex, HttpServletRequest request) {

        return ResponseEntity.badRequest().body(
                ErrorResponse.of(400, "MALFORMED_REQUEST",
                        "Request body is missing or malformed", request.getRequestURI()));
    }

    // ── 400 Wrong type for path/query param ──────────────────────────

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {

        String msg = "Invalid value '" + ex.getValue() + "' for parameter '" + ex.getName() + "'";
        return ResponseEntity.badRequest().body(
                ErrorResponse.of(400, "BAD_REQUEST", msg, request.getRequestURI()));
    }

    // ── 400 Business bad request ──────────────────────────────────────

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(
            BadRequestException ex, HttpServletRequest request) {

        return ResponseEntity.badRequest().body(
                ErrorResponse.of(400, "BAD_REQUEST", ex.getMessage(), request.getRequestURI()));
    }

    // ── 401 Not authenticated ─────────────────────────────────────────

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(
            AuthenticationException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                ErrorResponse.of(401, "UNAUTHORIZED",
                        "Authentication required", request.getRequestURI()));
    }

    // ── 403 Account blocked (checked before generic access denied) ───

    @ExceptionHandler(AccountBlockedException.class)
    public ResponseEntity<ErrorResponse> handleAccountBlocked(
            AccountBlockedException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                ErrorResponse.of(403, "ACCOUNT_BLOCKED", ex.getMessage(), request.getRequestURI()));
    }

    // ── 403 Access denied (wrong role) ───────────────────────────────

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(
            AccessDeniedException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                ErrorResponse.of(403, "ACCESS_DENIED",
                        "You do not have permission to perform this action",
                        request.getRequestURI()));
    }

    // ── 404 Resource not found ────────────────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
            ResourceNotFoundException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                ErrorResponse.of(404, "RESOURCE_NOT_FOUND", ex.getMessage(), request.getRequestURI()));
    }

    // ── 405 Wrong HTTP method ─────────────────────────────────────────

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(
            HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(
                ErrorResponse.of(405, "METHOD_NOT_ALLOWED", ex.getMessage(), request.getRequestURI()));
    }

    // ── 409 Generic conflict (duplicate name, email, etc.) ───────────

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(
            ConflictException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ErrorResponse.of(409, "CONFLICT", ex.getMessage(), request.getRequestURI()));
    }

    // ── 409 Stock unavailable ─────────────────────────────────────────

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ErrorResponse> handleInsufficientStock(
            InsufficientStockException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ErrorResponse.of(409, "INSUFFICIENT_STOCK", ex.getMessage(), request.getRequestURI()));
    }

    // ── 409 Illegal order state transition ───────────────────────────

    @ExceptionHandler(InvalidStateTransitionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidTransition(
            InvalidStateTransitionException ex, HttpServletRequest request) {

        return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ErrorResponse.of(409, "INVALID_STATE_TRANSITION",
                        ex.getMessage(), request.getRequestURI()));
    }

    // ── 409 Concurrency / Lock conflict ──────────────────────────────

    @ExceptionHandler({
            org.springframework.orm.ObjectOptimisticLockingFailureException.class,
            org.springframework.dao.PessimisticLockingFailureException.class
    })
    public ResponseEntity<ErrorResponse> handleConcurrencyConflict(
            Exception ex, HttpServletRequest request) {
        log.warn("Concurrency conflict on {}: {}", request.getRequestURI(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ErrorResponse.of(409, "CONCURRENCY_CONFLICT",
                        "High demand on this product right now — please retry your checkout.",
                        request.getRequestURI()));
    }

    // ── 500 Catch-all (unexpected errors) ────────────────────────────

    /**
     * Last-resort handler. Logs the full stack trace to the server log
     * (for debugging) but returns a generic, safe message to the client
     * — never expose internal details.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAll(
            Exception ex, HttpServletRequest request) {

        log.error("Unhandled exception on {} {}", request.getMethod(),
                request.getRequestURI(), ex);

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                ErrorResponse.of(500, "INTERNAL_ERROR",
                        "An unexpected error occurred. Please try again later.",
                        request.getRequestURI()));
    }
}
