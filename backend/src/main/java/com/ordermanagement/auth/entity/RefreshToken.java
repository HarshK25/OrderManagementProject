package com.ordermanagement.auth.entity;

import com.ordermanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Hashed refresh tokens stored in the DB for rotation and revocation.
 *
 * Design:
 *  - Only the SHA-256 hash is stored, never the raw token value.
 *  - On login a new pair is issued; on refresh the old row is marked revoked
 *    and a new one inserted (simple rotation — no reuse detection in this build).
 *  - On logout all refresh tokens for the user are revoked.
 *  - On block all refresh tokens for the user are revoked.
 *
 * Fetch type: LAZY — we never need the full User graph just to validate a token.
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean revoked = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
