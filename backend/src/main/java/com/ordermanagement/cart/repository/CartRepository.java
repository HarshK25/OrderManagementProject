package com.ordermanagement.cart.repository;

import com.ordermanagement.cart.entity.Cart;
import com.ordermanagement.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CartRepository extends JpaRepository<Cart, Long> {

    Optional<Cart> findByUser(User user);

    /**
     * Eagerly fetch cart + items + products in one query to avoid N+1
     * when rendering the full cart response.
     */
    @Query("""
            SELECT DISTINCT c FROM Cart c
            LEFT JOIN FETCH c.items ci
            LEFT JOIN FETCH ci.product p
            LEFT JOIN FETCH p.category
            WHERE c.user = :user
            """)
    Optional<Cart> findByUserWithItems(@Param("user") User user);
}
