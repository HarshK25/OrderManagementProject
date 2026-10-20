package com.ordermanagement.auth.service;

import com.ordermanagement.auth.dto.AuthResponse;
import com.ordermanagement.auth.dto.LoginRequest;
import com.ordermanagement.auth.dto.RegisterRequest;
import com.ordermanagement.auth.entity.RefreshToken;
import com.ordermanagement.auth.repository.RefreshTokenRepository;
import com.ordermanagement.common.exception.AccountBlockedException;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ConflictException;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.user.entity.Role;
import com.ordermanagement.user.entity.User;
import com.ordermanagement.user.entity.UserStatus;
import com.ordermanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

/**
 * Authentication business logic.
 *
 * Token strategy:
 *  ACCESS  — short-lived JWT (15 min). Stateless; validated by JwtService.
 *  REFRESH — opaque UUID. Only the SHA-256 hash is stored in the DB.
 *            On refresh: revoke old row → insert new row → return new pair.
 *
 * Security decisions:
 *  - "Invalid email or password" is returned for BOTH missing-user and wrong-password
 *    to prevent email enumeration.
 *  - Emails are lowercased at write-time so lookups are case-insensitive.
 *  - @Transactional ensures the refresh rotation is atomic — if issuing the new
 *    token fails, the old one stays valid.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final TokenBlacklistService blacklistService;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties appProperties;

    // ── Register ─────────────────────────────────────────────────────

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email already registered: " + email);
        }

        User user = User.builder()
                .name(request.getName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.CUSTOMER)
                .status(UserStatus.ACTIVE)
                .build();

        userRepository.save(user);
        log.info("New customer registered: {}", email);
        return issueTokenPair(user);
    }

    // ── Login ─────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().toLowerCase();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Invalid email or password");
        }

        if (user.getStatus() == UserStatus.BLOCKED) {
            throw new AccountBlockedException(email);
        }

        log.info("User logged in: {}", email);
        return issueTokenPair(user);
    }

    // ── Refresh ───────────────────────────────────────────────────────

    /**
     * Simple token rotation:
     *  1. Look up the refresh token by hash
     *  2. Validate it (not revoked, not expired)
     *  3. Check the associated user is still active
     *  4. Revoke the old token
     *  5. Issue a new pair
     */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        String hash = hash(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BadRequestException("Invalid or unknown refresh token"));

        if (stored.isRevoked()) {
            // Potential token reuse — revoke ALL tokens for this user
            log.warn("Refresh token reuse detected for user: {}", stored.getUser().getEmail());
            refreshTokenRepository.revokeAllByUser(stored.getUser());
            throw new BadRequestException("Refresh token has been revoked — please login again");
        }

        if (stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Refresh token expired — please login again");
        }

        if (stored.getUser().getStatus() == UserStatus.BLOCKED) {
            throw new AccountBlockedException(stored.getUser().getEmail());
        }

        // Revoke old, issue new
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return issueTokenPair(stored.getUser());
    }

    // ── Logout ────────────────────────────────────────────────────────

    /**
     * Dual invalidation:
     *  - Access token jti → Redis blacklist (TTL = remaining token life)
     *  - Refresh token    → DB revocation
     */
    @Transactional
    public void logout(String rawAccessToken, String rawRefreshToken) {
        // Blacklist the access token
        try {
            String jti = jwtService.extractJti(rawAccessToken);
            long ttl = jwtService.getRemainingTtlSeconds(rawAccessToken);
            if (ttl > 0) {
                blacklistService.blacklist(jti, ttl);
            }
        } catch (Exception e) {
            log.debug("Could not blacklist access token on logout: {}", e.getMessage());
        }

        // Revoke the refresh token
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokenRepository.findByTokenHash(hash(rawRefreshToken))
                    .ifPresent(rt -> {
                        rt.setRevoked(true);
                        refreshTokenRepository.save(rt);
                    });
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────

    private AuthResponse issueTokenPair(User user) {
        String accessToken = jwtService.generateAccessToken(user);

        String rawRefresh = UUID.randomUUID().toString();
        long expiryDays = appProperties.getJwt().getRefreshTokenExpiryDays();

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(hash(rawRefresh))
                .expiresAt(LocalDateTime.now().plusDays(expiryDays))
                .revoked(false)
                .build();

        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefresh)
                .tokenType("Bearer")
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    /**
     * SHA-256 hash of the raw token, Base64-encoded.
     * Only the hash is ever persisted — the raw value lives on the client only.
     */
    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
