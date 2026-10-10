package com.ordermanagement.cart.entity;

import com.ordermanagement.common.entity.BaseEntity;
import com.ordermanagement.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;

/**
 * Individual line in a cart.
 *
 * Composite unique constraint on (cart_id, product_id) ensures a product
 * appears at most once — quantity is updated, not duplicated.
 *
 * Fetch type LAZY on both FKs: we always load cart items together with their
 * product for price calculation, but do so explicitly via JOIN FETCH in the
 * repository to avoid N+1 queries.
 */
@Entity
@Table(
        name = "cart_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_cart_items_cart_product",
                columnNames = {"cart_id", "product_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Integer quantity;
}
