package com.ordermanagement.product.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ordermanagement.product.entity.Product;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Product response DTO.
 *
 * Includes both the raw {@code price} and the computed {@code effectivePrice}
 * (after discount) so the frontend never needs to recalculate pricing logic.
 *
 * {@code category} is null when no category is assigned — suppressed from
 * JSON output via @JsonInclude(NON_NULL) to keep the response clean.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductResponse {

    private Long id;
    private String name;
    private String description;

    /** Null if the product has no category. */
    private CategoryResponse category;

    private BigDecimal price;
    private BigDecimal discountPercent;

    /** Authoritative discounted price: price × (1 - discountPercent/100). */
    private BigDecimal effectivePrice;

    private int stock;
    private String imageUrl;
    private boolean active;
    private LocalDateTime createdAt;

    // ── Rating summary (populated by ReviewService, null if not fetched) ──
    private Double avgRating;      // e.g. 4.3
    private Long   reviewCount;    // total number of reviews

    public static ProductResponse from(Product p) {
        return ProductResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .category(p.getCategory() != null ? CategoryResponse.from(p.getCategory()) : null)
                .price(p.getPrice())
                .discountPercent(p.getDiscountPercent())
                .effectivePrice(p.getEffectivePrice())
                .stock(p.getStock())
                .imageUrl(p.getImageUrl())
                .active(p.isActive())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
