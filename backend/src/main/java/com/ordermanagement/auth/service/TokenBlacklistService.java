package com.ordermanagement.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Token blacklist backed by Redis.
 *
 * Key schema: "blacklist:{jti}"  →  "1"  (TTL = remaining token lifetime)
 *
 * Graceful degradation: if Redis is not in the context (dev without Redis
 * installed), both methods are no-ops / return false. This means logout does
 * NOT invalidate access tokens without Redis, but the refresh token is still
 * revoked in the DB — an acceptable trade-off for local development.
 */
@Service
@Slf4j
public class TokenBlacklistService {

    private static final String PREFIX = "blacklist:";

    /** Nullable — injected only when Redis autoconfiguration is active. */
    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * Add the token's jti to the blacklist with the given TTL.
     * No-op if Redis is unavailable.
     */
    public void blacklist(String jti, long ttlSeconds) {
        if (redisTemplate == null) {
            log.warn("Redis not available — token blacklisting skipped for jti={}", jti);
            return;
        }
        redisTemplate.opsForValue().set(PREFIX + jti, "1", Duration.ofSeconds(ttlSeconds));
        log.debug("Blacklisted token jti={} for {}s", jti, ttlSeconds);
    }

    /**
     * Check if a jti is blacklisted.
     * Returns false (allow) when Redis is unavailable.
     */
    public boolean isBlacklisted(String jti) {
        if (redisTemplate == null) {
            return false;
        }
        return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + jti));
    }
}
