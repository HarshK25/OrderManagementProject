package com.ordermanagement.user.service;

import com.ordermanagement.auth.repository.RefreshTokenRepository;
import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.user.dto.UserResponse;
import com.ordermanagement.user.entity.Role;
import com.ordermanagement.user.entity.User;
import com.ordermanagement.user.entity.UserStatus;
import com.ordermanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin user management.
 *
 * Block: sets status=BLOCKED and revokes all refresh tokens so the very
 *        next request with an unexpired access token still fails (the JWT
 *        filter checks status on every call via CustomUserDetailsService).
 * Delete: removes the user and cascades to refresh_tokens (ON DELETE CASCADE
 *         in the schema). Admin users cannot be deleted.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    // ── Admin: list / search ──────────────────────────────────────────

    @Transactional(readOnly = true)
    public PagedResponse<UserResponse> listUsers(String search, Pageable pageable) {
        Page<UserResponse> page;
        if (search != null && !search.isBlank()) {
            page = userRepository.searchByNameOrEmail(search.trim(), pageable)
                    .map(UserResponse::from);
        } else {
            page = userRepository.findAll(pageable).map(UserResponse::from);
        }
        return PagedResponse.from(page);
    }

    // ── Admin: block ──────────────────────────────────────────────────

    @Transactional
    public UserResponse blockUser(Long userId) {
        User user = findNonAdminUser(userId);
        if (user.getStatus() == UserStatus.BLOCKED) {
            throw new BadRequestException("User is already blocked");
        }
        user.setStatus(UserStatus.BLOCKED);
        userRepository.save(user);
        // Revoke all refresh tokens so the user cannot silently re-authenticate
        refreshTokenRepository.revokeAllByUser(user);
        log.info("User {} blocked", user.getEmail());
        return UserResponse.from(user);
    }

    // ── Admin: unblock ────────────────────────────────────────────────

    @Transactional
    public UserResponse unblockUser(Long userId) {
        User user = findNonAdminUser(userId);
        if (user.getStatus() == UserStatus.ACTIVE) {
            throw new BadRequestException("User is already active");
        }
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        log.info("User {} unblocked", user.getEmail());
        return UserResponse.from(user);
    }

    // ── Admin: delete ─────────────────────────────────────────────────

    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (user.getRole() == Role.ADMIN) {
            throw new BadRequestException("Admin accounts cannot be deleted");
        }
        // Revoke tokens before deletion to immediately invalidate any active session
        refreshTokenRepository.revokeAllByUser(user);
        userRepository.delete(user);
        log.info("User {} (id={}) deleted by admin", user.getEmail(), userId);
    }

    // ── Helper ────────────────────────────────────────────────────────

    private User findNonAdminUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (user.getRole() == Role.ADMIN) {
            throw new BadRequestException("Admin accounts cannot be modified");
        }
        return user;
    }
}
