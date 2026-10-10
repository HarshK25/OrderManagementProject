package com.ordermanagement.common;

import com.ordermanagement.common.exception.*;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

/**
 * Dev-only controller for verifying the exception handler.
 * Only active in the "dev" profile — never deployed to production.
 *
 * Test endpoints:
 *   GET  /api/test/not-found           → 404
 *   GET  /api/test/conflict            → 409
 *   GET  /api/test/bad-request         → 400
 *   GET  /api/test/stock               → 409 INSUFFICIENT_STOCK
 *   GET  /api/test/state               → 409 INVALID_STATE_TRANSITION
 *   GET  /api/test/blocked             → 403 ACCOUNT_BLOCKED
 *   GET  /api/test/server-error        → 500
 *   POST /api/test/validation          → 400 with fieldErrors (send empty JSON {})
 */
@RestController
@RequestMapping("/api/test")
@Profile("dev")
@Hidden   // hidden from Swagger in all profiles
class TestExceptionController {

    @GetMapping("/not-found")
    public void notFound() {
        throw new ResourceNotFoundException("Product", 99L);
    }

    @GetMapping("/conflict")
    public void conflict() {
        throw new ConflictException("Category 'Electronics' already exists");
    }

    @GetMapping("/bad-request")
    public void badRequest() {
        throw new BadRequestException("Cart is empty — cannot place order");
    }

    @GetMapping("/stock")
    public void stock() {
        throw new InsufficientStockException("Laptop Pro", 5, 2);
    }

    @GetMapping("/state")
    public void state() {
        throw new InvalidStateTransitionException("Order ORD-001: cannot transition from EXPIRED to PAID");
    }

    @GetMapping("/blocked")
    public void blocked() {
        throw new AccountBlockedException("user@example.com");
    }

    @GetMapping("/server-error")
    public void serverError() {
        throw new RuntimeException("Something exploded");
    }

    @PostMapping("/validation")
    public void validation(@Valid @RequestBody SampleRequest req) {}

    @Data
    static class SampleRequest {
        @NotBlank(message = "name must not be blank")
        private String name;

        @NotBlank(message = "email must not be blank")
        private String email;
    }
}
