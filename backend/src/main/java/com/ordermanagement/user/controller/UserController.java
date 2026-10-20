package com.ordermanagement.user.controller;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.user.dto.UserResponse;
import com.ordermanagement.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * Admin user management endpoints.
 *
 * All paths under /api/admin/** are secured to ADMIN role via SecurityFilterChain.
 *
 * GET    /api/admin/users                — paginated list with optional search
 * PATCH  /api/admin/users/{id}/block     — block a user (revokes refresh tokens)
 * PATCH  /api/admin/users/{id}/unblock   — unblock a user
 * DELETE /api/admin/users/{id}           — permanently delete a user (non-admin only)
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Admin – Users", description = "Admin user management")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    @GetMapping("/api/admin/users")
    @Operation(summary = "List all users with optional name/email search (admin)")
    public PagedResponse<UserResponse> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return userService.listUsers(search, pageable);
    }

    @PatchMapping("/api/admin/users/{id}/block")
    @Operation(summary = "Block a user — revokes tokens immediately (admin)")
    public UserResponse blockUser(@PathVariable Long id) {
        return userService.blockUser(id);
    }

    @PatchMapping("/api/admin/users/{id}/unblock")
    @Operation(summary = "Unblock a user (admin)")
    public UserResponse unblockUser(@PathVariable Long id) {
        return userService.unblockUser(id);
    }

    @DeleteMapping("/api/admin/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Permanently delete a user account (admin only, non-admin users)")
    public void deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
    }
}
