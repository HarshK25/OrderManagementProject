package com.ordermanagement.cart.repository;

import com.ordermanagement.cart.entity.Cart;
import com.ordermanagement.cart.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    Optional<CartItem> findByCartAndProductId(Cart cart, Long productId);

    void deleteByCartAndProductId(Cart cart, Long productId);
}
