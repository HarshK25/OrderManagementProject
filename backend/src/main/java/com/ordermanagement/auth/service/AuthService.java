package com.ordermanagement.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordermanagement.auth.dto.AuthResponse;
import com.ordermanagement.auth.dto.LoginRequest;
import com.ordermanagement.auth.dto.RegisterRequest;
import com.ordermanagement.auth.entity.RefreshToken;
import com.ordermanagement.auth.repository.RefreshTokenRepository;
import com.ordermanagement.common.exception.AccountBlockedException;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ConflictException;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.notification.service.EmailService;
import com.ordermanagement.user.entity.Role;
import com.ordermanagement.user.entity.User;
import com.ordermanagement.user.entity.UserStatus;
import com.ordermanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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

    private static final String REG_OTP_PREFIX   = "oms:auth:reg_otp:";
    private static final String RESET_OTP_PREFIX = "oms:auth:reset_otp:";
    private static final Duration OTP_TTL        = Duration.ofMinutes(10);
    private static final SecureRandom SECURE_RNG = new SecureRandom();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final TokenBlacklistService blacklistService;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties appProperties;
    private final EmailService emailService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private final Map<String, String> localOtpFallback = new ConcurrentHashMap<>();

    // ── Register (Direct + 2-step Email Confirmation OTP) ────────────

    public Map<String, Object> sendRegistrationOtp(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        validateEmailDomainHasMailServer(email);
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email already registered: " + email);
        }

        String otp = generateSixDigitOtp();
        String name = request.getName().trim();
        String encodedPw = passwordEncoder.encode(request.getPassword());

        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "name", name,
                    "email", email,
                    "passwordHash", encodedPw,
                    "otp", otp
            ));
            storeOtp(REG_OTP_PREFIX + email, payload);
        } catch (Exception ex) {
            throw new RuntimeException("Could not initialize email confirmation", ex);
        }

        emailService.sendRegistrationOtpEmail(email, name, otp);
        log.info("Registration confirmation OTP sent to {}", email);
        return Map.of(
                "message", "A 6-digit confirmation code has been sent to " + email,
                "email", email,
                "expiresInMinutes", 10
        );
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public AuthResponse verifyRegistrationOtp(String rawEmail, String rawOtp) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        String otp = rawOtp == null ? "" : rawOtp.trim();
        if (email.isEmpty() || !otp.matches("^\\d{6}$")) {
            throw new BadRequestException("Enter a valid 6-digit confirmation code.");
        }

        String key = REG_OTP_PREFIX + email;
        String payload = readOtp(key);
        if (payload == null) {
            throw new BadRequestException("Confirmation code expired or not found. Please request a new code.");
        }

        Map<String, String> data;
        try {
            data = objectMapper.readValue(payload, Map.class);
        } catch (Exception ex) {
            throw new BadRequestException("Invalid verification session. Please try again.");
        }

        if (!otp.equals(data.get("otp"))) {
            throw new BadRequestException("Incorrect confirmation code. Please check your email and try again.");
        }

        if (userRepository.existsByEmail(email)) {
            deleteOtp(key);
            throw new ConflictException("Email already registered: " + email);
        }

        User user = User.builder()
                .name(data.get("name"))
                .email(email)
                .passwordHash(data.get("passwordHash"))
                .role(Role.CUSTOMER)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(user);
        deleteOtp(key);

        try {
            emailService.sendWelcomeConfirmationEmail(email, user.getName());
        } catch (Exception ex) {
            log.warn("Welcome confirmation email failed after account creation for {}: {}", email, ex.getMessage());
        }

        log.info("Verified & registered new customer: {}", email);
        return issueTokenPair(user);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        validateEmailDomainHasMailServer(email);
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
        try {
            emailService.sendWelcomeConfirmationEmail(email, user.getName());
        } catch (Exception ex) {
            log.warn("Welcome confirmation email skipped for {}: {}", email, ex.getMessage());
        }
        log.info("New customer registered: {}", email);
        return issueTokenPair(user);
    }

    // ── Forgot Password / Reset Password ─────────────────────────────

    public Map<String, Object> sendPasswordResetOtp(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (email.isEmpty()) {
            throw new BadRequestException("Enter your registered email address.");
        }

        userRepository.findByEmail(email).ifPresent(user -> {
            if (user.getStatus() == UserStatus.BLOCKED) return;
            String otp = generateSixDigitOtp();
            storeOtp(RESET_OTP_PREFIX + email, otp);
            emailService.sendPasswordResetOtpEmail(email, user.getName(), otp);
            log.info("Password reset OTP sent to {}", email);
        });

        return Map.of(
                "message", "If an account exists for " + email + ", a 6-digit password reset code has been sent.",
                "expiresInMinutes", 10
        );
    }

    @Transactional
    public Map<String, Object> resetPassword(String rawEmail, String rawOtp, String newPassword) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        String otp = rawOtp == null ? "" : rawOtp.trim();
        if (email.isEmpty() || !otp.matches("^\\d{6}$")) {
            throw new BadRequestException("Enter a valid email and 6-digit reset code.");
        }
        if (newPassword == null || newPassword.length() < 8) {
            throw new BadRequestException("New password must be at least 8 characters.");
        }

        String key = RESET_OTP_PREFIX + email;
        String storedOtp = readOtp(key);
        if (storedOtp == null || !storedOtp.equals(otp)) {
            throw new BadRequestException("Invalid or expired reset code. Please request a new one.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Account not found."));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUser(user);
        deleteOtp(key);

        log.info("Password reset completed for {}", email);
        return Map.of("message", "Password updated successfully. You can now sign in with your new password.");
    }

    private String generateSixDigitOtp() {
        return String.format("%06d", SECURE_RNG.nextInt(1_000_000));
    }

    private void storeOtp(String key, String value) {
        localOtpFallback.put(key, value);
        try {
            redisTemplate.opsForValue().set(key, value, OTP_TTL);
        } catch (Exception ex) {
            log.debug("Redis OTP store fallback: {}", ex.getMessage());
        }
    }

    private String readOtp(String key) {
        try {
            String v = redisTemplate.opsForValue().get(key);
            if (v != null) return v;
        } catch (Exception ex) {
            log.debug("Redis OTP read fallback: {}", ex.getMessage());
        }
        return localOtpFallback.get(key);
    }

    private void deleteOtp(String key) {
        localOtpFallback.remove(key);
        try {
            redisTemplate.delete(key);
        } catch (Exception ignored) {}
    }

    /**
     * Verifies that the email domain has valid DNS MX (or A) records so fake/typo
     * domains (e.g. test@asdfgh12345.com) cannot register.
     */
    private void validateEmailDomainHasMailServer(String email) {
        int at = email.lastIndexOf('@');
        if (at < 1 || at == email.length() - 1) {
            throw new BadRequestException("Enter a valid email address");
        }
        String domain = email.substring(at + 1);
        if (email.contains("..")) {
            throw new BadRequestException("Email address cannot contain consecutive dots");
        }
        try {
            java.util.Hashtable<String, String> env = new java.util.Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            env.put("com.sun.jndi.dns.timeout.initial", "2000");
            env.put("com.sun.jndi.dns.timeout.retries", "1");
            javax.naming.directory.InitialDirContext ctx = new javax.naming.directory.InitialDirContext(env);
            javax.naming.directory.Attributes attrs = ctx.getAttributes(domain, new String[]{"MX"});
            javax.naming.directory.Attribute mx = attrs.get("MX");
            if (mx != null && mx.size() > 0) {
                return;
            }
            // Fallback: check A record if no MX record
            javax.naming.directory.Attributes aAttrs = ctx.getAttributes(domain, new String[]{"A"});
            if (aAttrs.get("A") != null && aAttrs.get("A").size() > 0) {
                return;
            }
            throw new BadRequestException("Email domain '" + domain + "' cannot receive emails. Please check for typos.");
        } catch (javax.naming.NameNotFoundException ex) {
            throw new BadRequestException("Email domain '" + domain + "' does not exist. Please enter a real email address.");
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            // If DNS lookup itself is temporarily unreachable, don't block valid registrations
            log.warn("DNS MX check skipped for {}: {}", domain, ex.getMessage());
        }
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
