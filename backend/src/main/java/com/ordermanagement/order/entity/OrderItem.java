package com.ordermanagement.order.entity;

import com.ordermanagement.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Immutable snapshot of one line in an order.
 *
 * Why snapshot data (productName, unitPrice)?
 * If a product is later edited or deleted, old orders must still show the
 * correct name and price that the customer actually paid. Never join order_items
 * to products for price display — use the snapshot columns.
 *
 * product_id FK is informational only (SET NULL on delete) and useful for
 * admin analytics but is NOT used to compute prices.
 */
@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** Informational — SET NULL on product delete. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    // ── Snapshot data ────────────────────────────────────────────────
    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "line_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
