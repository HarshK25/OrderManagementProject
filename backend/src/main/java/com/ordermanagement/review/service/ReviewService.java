package com.ordermanagement.review.service;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.review.dto.ProductRatingSummary;
import com.ordermanagement.review.dto.ReviewRequest;
import com.ordermanagement.review.dto.ReviewResponse;
import com.ordermanagement.review.entity.ProductReview;
import com.ordermanagement.review.repository.ReviewRepository;
import com.ordermanagement.user.entity.User;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Business logic for product reviews and ratings.
 *
 * Rules:
 * - Only customers with a DELIVERED order containing the product can review it
 * - One review per user per product (edit is allowed via upsert)
 * - Rating 1–5 stars, optional title + body
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final EntityManager em;

    private static final List<OrderStatus> ELIGIBLE_STATUSES = List.of(
            OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED,
            OrderStatus.RETURN_APPROVED, OrderStatus.RETURN_REJECTED,
            OrderStatus.PICKUP_COMPLETED, OrderStatus.REFUNDED);

    // ── Submit or update review ───────────────────────────────────────────────

    @Transactional
    public ReviewResponse submitReview(Long productId, User user, ReviewRequest dto) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

        ProductReview existing = reviewRepository
                .findByUserIdAndProductId(user.getId(), productId)
                .orElse(null);

        Long resolvedOrderId = dto.orderId();
        if (resolvedOrderId == null || resolvedOrderId <= 0) {
            if (existing != null && existing.getOrder() != null) {
                resolvedOrderId = existing.getOrder().getId();
            } else {
                List<Long> eligible = getEligibleOrderIds(productId, user.getId());
                if (eligible.isEmpty()) {
                    throw new BadRequestException("You can only review products from DELIVERED orders");
                }
                resolvedOrderId = eligible.get(0);
            }
        }

        final Long targetOrderId = resolvedOrderId;
        Order order = orderRepository.findById(targetOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", targetOrderId));

        if (!order.getUser().getId().equals(user.getId())) {
            throw new BadRequestException("Order does not belong to you");
        }
        if (!ELIGIBLE_STATUSES.contains(order.getStatus())) {
            throw new BadRequestException("You can only review products from DELIVERED orders");
        }

        // Verify product is part of this order (load items)
        boolean productInOrder = order.getItems().stream()
                .anyMatch(item -> item.getProduct() != null
                        && item.getProduct().getId().equals(productId));
        if (!productInOrder) {
            throw new BadRequestException("This product is not part of the specified order");
        }

        // Upsert — allow editing existing review
        ProductReview review = existing != null ? existing
                : ProductReview.builder()
                        .product(product)
                        .user(user)
                        .order(order)
                        .build();

        review.setRating(dto.rating().shortValue());
        review.setTitle(dto.title());
        review.setBody(dto.body());

        review = reviewRepository.save(review);
        log.info("Review saved: productId={} userId={} rating={}", productId, user.getId(), dto.rating());
        return ReviewResponse.from(review);
    }

    // ── Paginated reviews for a product ───────────────────────────────────────

    @Transactional(readOnly = true)
    public PagedResponse<ReviewResponse> getReviews(Long productId, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        var pg = reviewRepository.findByProductId(productId, pageable)
                .map(ReviewResponse::from);
        return PagedResponse.from(pg);
    }

    // ── Rating summary (avg + star distribution) ──────────────────────────────

    @Transactional(readOnly = true)
    public ProductRatingSummary getRatingSummary(Long productId) {
        double avg = reviewRepository.avgRatingByProductId(productId);
        long total = reviewRepository.countByProductId(productId);

        List<Object[]> dist = reviewRepository.ratingDistributionByProductId(productId);
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int i = 5; i >= 1; i--)
            distribution.put(i, 0L);
        for (Object[] row : dist) {
            distribution.put(((Number) row[0]).intValue(), (Long) row[1]);
        }

        double rounded = Math.round(avg * 10.0) / 10.0;
        return new ProductRatingSummary(rounded, total, distribution);
    }

    // ── Check if user is eligible to review this product ──────────────────────

    @Transactional(readOnly = true)
    public boolean canUserReview(Long productId, Long userId) {
        if (reviewRepository.existsByUserIdAndProductId(userId, productId)) {
            return false; // already reviewed
        }
        Long count = em.createQuery("""
                SELECT COUNT(o) FROM Order o
                JOIN o.items i
                WHERE o.user.id    = :userId
                  AND o.status     IN :statuses
                  AND i.product.id = :productId
                """, Long.class)
                .setParameter("userId", userId)
                .setParameter("productId", productId)
                .setParameter("statuses", ELIGIBLE_STATUSES)
                .getSingleResult();
        return count > 0;
    }

    // ── Get user's existing review for a product ──────────────────────────────

    @Transactional(readOnly = true)
    public ReviewResponse getUserReview(Long productId, Long userId) {
        return reviewRepository.findByUserIdAndProductId(userId, productId)
                .map(ReviewResponse::from)
                .orElse(null);
    }

    // ── Get eligible order IDs for user to attach a review ────────────────────

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public List<Long> getEligibleOrderIds(Long productId, Long userId) {
        return em.createQuery("""
                SELECT DISTINCT o.id FROM Order o
                JOIN o.items i
                WHERE o.user.id    = :userId
                  AND o.status     IN :statuses
                  AND i.product.id = :productId
                """, Long.class)
                .setParameter("userId", userId)
                .setParameter("productId", productId)
                .setParameter("statuses", ELIGIBLE_STATUSES)
                .getResultList();
    }

    // ── Bulk rating summaries for a list of product IDs ───────────────────────

    @Transactional(readOnly = true)
    public Map<Long, ProductRatingSummary> getBulkSummaries(List<Long> productIds) {
        if (productIds == null || productIds.isEmpty())
            return Map.of();
        Map<Long, ProductRatingSummary> result = new java.util.LinkedHashMap<>();
        for (Long pid : productIds) {
            result.put(pid, getRatingSummary(pid));
        }
        return result;
    }

    // ── Delete review (admin) ─────────────────────────────────────────────────

    @Transactional
    public void deleteReview(Long reviewId) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review", reviewId));
        reviewRepository.delete(review);
    }
}
