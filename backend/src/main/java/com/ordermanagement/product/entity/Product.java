package com.ordermanagement.product.entity;

import com.ordermanagement.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Product entity.
 *
 * Design decisions:
 *  - category is LAZY to avoid eager joins on every product load.
 *  - soft delete via `active` flag — deleted products still appear on old orders.
 *  - stock is managed with atomic conditional UPDATEs in the order service,
 *    never with read-then-write in Java (would oversell under concurrency).
 *  - effectivePrice() is the single authoritative calculation — used by every
 *    layer that needs the discounted price (cart totals, order capture, etc.).
 *
 * Note: stock is NOT cached in Redis because it changes on every order placement
 * and expiry. Stale stock in cache would show wrong availability to customers.
 */
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Nullable — a product can exist without a category. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    /** 0–90 %. Stored as a simple percent, e.g. 10 means 10 %. */
    @Column(name = "discount_percent", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal discountPercent = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Integer stock = 0;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    /** Optimistic locking guard against concurrent lost updates. */
    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @Column(name = "seller_id")
    private Long sellerId;

    // ── Business logic ───────────────────────────────────────────────

    /**
     * The single authoritative effective-price calculation.
     * price × (1 - discountPercent / 100), rounded HALF_UP to 2 decimal places.
     */
    @Transient
    public BigDecimal getEffectivePrice() {
        if (discountPercent == null || discountPercent.compareTo(BigDecimal.ZERO) == 0) {
            return price;
        }
        BigDecimal multiplier = BigDecimal.ONE
                .subtract(discountPercent.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        return price.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
    }
}
