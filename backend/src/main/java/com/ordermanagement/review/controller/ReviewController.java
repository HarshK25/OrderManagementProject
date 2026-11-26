package com.ordermanagement.review.controller;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.review.dto.ProductRatingSummary;
import com.ordermanagement.review.dto.ReviewRequest;
import com.ordermanagement.review.dto.ReviewResponse;
import com.ordermanagement.review.service.ReviewService;
import com.ordermanagement.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Product review endpoints.
 *
 * Public:
 *   GET /api/products/{productId}/reviews            — paginated reviews
 *   GET /api/products/{productId}/reviews/summary    — avg rating + distribution
 *
 * Customer (authenticated):
 *   POST   /api/products/{productId}/reviews         — submit/update review
 *   GET    /api/products/{productId}/reviews/mine    — my review for this product
 *
 * Admin:
 *   DELETE /api/admin/reviews/{reviewId}             — remove a review
 */
@RestController
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    // ── Public ────────────────────────────────────────────────────────────────

    @GetMapping("/api/products/{productId}/reviews")
    public PagedResponse<ReviewResponse> getReviews(
            @PathVariable Long productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return reviewService.getReviews(productId, page, size);
    }

    @GetMapping("/api/products/{productId}/reviews/summary")
    public ProductRatingSummary getRatingSummary(@PathVariable Long productId) {
        return reviewService.getRatingSummary(productId);
    }

    /** Bulk summaries for a list of product IDs — used by the product listing page. */
    @GetMapping("/api/products/reviews/summaries")
    public java.util.Map<Long, ProductRatingSummary> getBulkSummaries(
            @RequestParam java.util.List<Long> ids) {
        return reviewService.getBulkSummaries(ids);
    }

    // ── Customer ──────────────────────────────────────────────────────────────

    @PostMapping("/api/products/{productId}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse submitReview(
            @PathVariable Long productId,
            @Valid @RequestBody ReviewRequest dto,
            @AuthenticationPrincipal User user) {
        return reviewService.submitReview(productId, user, dto);
    }

    @GetMapping("/api/products/{productId}/reviews/mine")
    public ReviewResponse getMyReview(
            @PathVariable Long productId,
            @AuthenticationPrincipal User user) {
        return reviewService.getUserReview(productId, user.getId());
    }

    @GetMapping("/api/products/{productId}/reviews/can-review")
    public java.util.Map<String, Object> canReview(
            @PathVariable Long productId,
            @AuthenticationPrincipal User user) {
        boolean can = reviewService.canUserReview(productId, user.getId());
        java.util.List<Long> orderIds = can
                ? reviewService.getEligibleOrderIds(productId, user.getId())
                : java.util.List.of();
        return java.util.Map.of("canReview", can, "eligibleOrderIds", orderIds);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    @DeleteMapping("/api/admin/reviews/{reviewId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteReview(@PathVariable Long reviewId) {
        reviewService.deleteReview(reviewId);
    }
}

