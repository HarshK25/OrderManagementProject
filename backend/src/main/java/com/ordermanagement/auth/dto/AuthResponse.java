package com.ordermanagement.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    @Builder.Default
    private String tokenType = "Bearer";

    // User info — lets the frontend know who is logged in without a separate /me call
    private Long   userId;
    private String name;
    private String email;
    private String role;
}
