package com.ordermanagement.returns.controller;

import com.ordermanagement.returns.dto.AdminReturnActionDto;
import com.ordermanagement.returns.dto.ReturnRequestDto;
import com.ordermanagement.returns.dto.ReturnResponse;
import com.ordermanagement.returns.service.ReturnService;
import com.ordermanagement.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Return & Refund endpoints.
 *
 * Customer endpoints:
 * POST /api/orders/{orderId}/return — request return
 * GET /api/orders/{orderId}/return — view return status
 *
 * Admin endpoints:
 * GET /api/admin/returns — list all returns
 * GET /api/admin/returns/{id} — view single return
 * PATCH /api/admin/returns/{id}/approve — approve → email sent
 * PATCH /api/admin/returns/{id}/reject — reject → email sent
 * PATCH /api/admin/returns/{id}/pickup-completed — pickup done → refund → email
 */
@RestController
@RequiredArgsConstructor
public class ReturnController {

    private final ReturnService returnService;

    // ── Customer ─────────────────────────────────────────────────────────────

    @PostMapping("/api/orders/{orderId}/return")
    @ResponseStatus(HttpStatus.CREATED)
    public ReturnResponse requestReturn(
            @PathVariable Long orderId,
            @Valid @RequestBody ReturnRequestDto dto,
            @AuthenticationPrincipal User user) {
        return returnService.requestReturn(orderId, user.getId(), dto);
    }

    @GetMapping("/api/orders/{orderId}/return")
    public ReturnResponse getReturnStatus(
            @PathVariable Long orderId,
            @AuthenticationPrincipal User user) {
        return returnService.getReturnByOrderId(orderId, user.getId());
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    @GetMapping("/api/admin/returns")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ReturnResponse> getAllReturns() {
        return returnService.getAllReturns();
    }

    @GetMapping("/api/admin/returns/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ReturnResponse getReturn(@PathVariable Long id) {
        return returnService.getReturnById(id);
    }

    @PatchMapping("/api/admin/returns/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ReturnResponse approveReturn(
            @PathVariable Long id,
            @Valid @RequestBody AdminReturnActionDto dto) {
        return returnService.approveReturn(id, dto);
    }

    @PatchMapping("/api/admin/returns/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ReturnResponse rejectReturn(
            @PathVariable Long id,
            @Valid @RequestBody AdminReturnActionDto dto) {
        return returnService.rejectReturn(id, dto);
    }

    @PatchMapping("/api/admin/returns/{id}/pickup-completed")
    @PreAuthorize("hasRole('ADMIN')")
    public ReturnResponse markPickupCompleted(@PathVariable Long id) {
        return returnService.markPickupCompleted(id);
    }
}
