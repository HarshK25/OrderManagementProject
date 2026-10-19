package com.ordermanagement.auth.controller;

import com.ordermanagement.auth.dto.*;
import com.ordermanagement.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Authentication REST endpoints.
 *
 * All routes are PUBLIC (permit-all in SecurityConfig) — the JWT filter
 * still runs but does not reject unauthenticated requests to this controller.
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ Method │ Path                    │ Description             │
 * ├────────────────────────────────────────────────────────────┤
 * │ POST   │ /api/auth/register      │ Create account          │
 * │ POST   │ /api/auth/login         │ Get token pair          │
 * │ POST   │ /api/auth/refresh       │ Rotate refresh token    │
 * │ POST   │ /api/auth/logout        │ Invalidate tokens       │
 * └────────────────────────────────────────────────────────────┘
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Register, login, refresh, and logout")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a new customer account")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Login and receive access + refresh tokens")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange a refresh token for a new token pair (rotation)")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.getRefreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Blacklist the access token and revoke the refresh token")
    public ResponseEntity<Void> logout(
            HttpServletRequest httpRequest,
            @Valid @RequestBody LogoutRequest request) {

        String authHeader = httpRequest.getHeader("Authorization");
        String rawAccessToken = (authHeader != null && authHeader.startsWith("Bearer "))
                ? authHeader.substring(7) : null;

        authService.logout(rawAccessToken, request.getRefreshToken());
        return ResponseEntity.noContent().build();
    }
}
