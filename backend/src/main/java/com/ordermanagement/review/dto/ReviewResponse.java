package com.ordermanagement.review.dto;

import com.ordermanagement.review.entity.ProductReview;

import java.time.LocalDateTime;

public record ReviewResponse(
        Long   id,
        Long   productId,
        Long   userId,
        String customerName,
        int    rating,
        String title,
        String body,
        Long   orderId,
        LocalDateTime createdAt
) {
    public static ReviewResponse from(ProductReview r) {
        return new ReviewResponse(
                r.getId(),
                r.getProduct().getId(),
                r.getUser().getId(),
                r.getUser().getName(),
                r.getRating(),
                r.getTitle(),
                r.getBody(),
                r.getOrder().getId(),
                r.getCreatedAt()
        );
    }
}

