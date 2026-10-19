package com.ordermanagement.auth.service;

import com.ordermanagement.config.AppProperties;
import com.ordermanagement.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * JWT access token service (HS512).
 *
 * Token anatomy:
 *  sub   — user email (stable identity for DB lookup in the filter)
 *  role  — "CUSTOMER" or "ADMIN" (avoids a DB hit for authorization checks)
 *  jti   — UUID per-token ID (used for blacklisting on logout)
 *  iat   — issued at
 *  exp   — expiry (access: 15 min, configurable in application.yml)
 *
 * Note: refresh tokens are random UUIDs stored as SHA-256 hashes in the DB
 * — they are NOT JWTs and are not handled here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    private final AppProperties appProperties;
    private SecretKey signingKey;

    @PostConstruct
    void init() {
        String secret = appProperties.getJwt().getSecret();
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 64) {
            log.warn("JWT secret is shorter than 512 bits — use at least 64 chars in production");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    // ── Generate ──────────────────────────────────────────────────────

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        long expiryMs = appProperties.getJwt().getAccessTokenExpiryMs();

        return Jwts.builder()
                .subject(user.getEmail())
                .claim("role", user.getRole().name())
                .id(UUID.randomUUID().toString())       // jti — for blacklisting
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(expiryMs)))
                .signWith(signingKey)
                .compact();
    }

    // ── Parse / validate ──────────────────────────────────────────────

    /**
     * Parse and verify the token. Throws {@link JwtException} on any failure
     * (expired, tampered, wrong key). Callers should catch JwtException and
     * treat it as unauthenticated rather than letting it propagate.
     */
    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    /** The unique token ID — used as the blacklist key in Redis. */
    public String extractJti(String token) {
        return extractAllClaims(token).getId();
    }

    /**
     * Remaining lifetime in seconds for the token.
     * Returns 0 if the token is already expired (guards against negative TTL).
     */
    public long getRemainingTtlSeconds(String token) {
        try {
            Date expiry = extractAllClaims(token).getExpiration();
            long remaining = (expiry.getTime() - System.currentTimeMillis()) / 1000;
            return Math.max(0, remaining);
        } catch (JwtException e) {
            return 0;
        }
    }

    /** Quick validity check — catches signature failure and expiry. */
    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }
}
