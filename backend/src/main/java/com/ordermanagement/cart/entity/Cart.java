package com.ordermanagement.cart.entity;

import com.ordermanagement.common.entity.BaseEntity;
import com.ordermanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * One cart per user (unique on user_id).
 * Cart is created lazily on first add-to-cart.
 *
 * CascadeType.ALL + orphanRemoval: deleting the cart or removing an item from
 * the items list cascades to cart_items, keeping data consistent without
 * manual delete calls.
 */
@Entity
@Table(name = "carts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cart extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @OneToMany(
            mappedBy = "cart",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    @Builder.Default
    private List<CartItem> items = new ArrayList<>();
}
