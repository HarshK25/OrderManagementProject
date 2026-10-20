package com.ordermanagement.user.dto;

import com.ordermanagement.user.entity.User;

import java.time.LocalDateTime;

/**
 * Admin-safe user view — never exposes passwordHash.
 */
public record UserResponse(
        Long id,
        String name,
        String email,
        String role,
        String status,
        LocalDateTime createdAt
) {
    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(),
                u.getName(),
                u.getEmail(),
                u.getRole().name(),
                u.getStatus().name(),
                u.getCreatedAt()
        );
    }
}
