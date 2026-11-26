package com.ordermanagement.review.entity;

import com.ordermanagement.order.entity.Order;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A verified product review — only allowed for DELIVERED orders.
 *
 * Constraints:
 *  - One review per user per product (UNIQUE on user_id + product_id)
 *  - Rating 1–5 stars (DB CHECK constraint)
 *  - Linked to the specific order that proved the purchase (prevents fake reviews)
 */
@Entity
@Table(name = "product_reviews",
       uniqueConstraints = @UniqueConstraint(
               name = "uq_review_user_product",
               columnNames = {"user_id", "product_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(nullable = false)
    private Short rating;   // 1–5

    @Column(length = 150)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

