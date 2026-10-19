package com.ordermanagement.product.repository;

import com.ordermanagement.product.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long>,
        JpaSpecificationExecutor<Product> {

    /**
     * Fetch a single product with its category in one query (avoids lazy-load N+1
     * when mapping to DTO outside a transaction).
     */
    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.id = :id")
    Optional<Product> findByIdWithCategory(@Param("id") Long id);

    /**
     * Atomic stock decrement with optimistic guard — returns rows affected (0 or 1).
     * Only decrements when stock >= quantity, preventing negative stock without
     * application-level locking.
     * Used by OrderService when capturing an order.
     */
    @Modifying
    @Query("""
            UPDATE Product p
            SET p.stock = p.stock - :quantity
            WHERE p.id = :id AND p.stock >= :quantity
            """)
    int decrementStockIfAvailable(@Param("id") Long id, @Param("quantity") int quantity);

    /**
     * Atomic stock increment — used to restore stock on order cancellation/expiry.
     */
    @Modifying
    @Query("UPDATE Product p SET p.stock = p.stock + :quantity WHERE p.id = :id")
    void incrementStock(@Param("id") Long id, @Param("quantity") int quantity);
}
