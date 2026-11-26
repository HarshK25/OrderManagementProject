package com.ordermanagement.review.dto;

import java.util.List;
import java.util.Map;

/**
 * Full rating summary for a product — displayed under the product on listing + detail pages.
 */
public record ProductRatingSummary(
        double avgRating,        // e.g. 4.3
        long   totalReviews,
        Map<Integer, Long> distribution   // { 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }
) {}

