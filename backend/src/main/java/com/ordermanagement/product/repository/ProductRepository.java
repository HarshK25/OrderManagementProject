package com.ordermanagement.product.repository;

import com.ordermanagement.product.entity.Product;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
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
     * Pessimistic row-level lock (SELECT ... FOR UPDATE) with 3-second lock timeout.
     * Always call in ascending productId order to eliminate deadlocks when multiple
     * users purchase overlapping multi-item carts concurrently.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")})
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);

    /**
     * Atomic stock decrement with guard — returns rows affected (0 or 1).
     * Also increments the optimistic @Version column so concurrent readers detect changes.
     */
    @Modifying
    @Query("""
            UPDATE Product p
            SET p.stock = p.stock - :quantity,
                p.version = p.version + 1
            WHERE p.id = :id AND p.stock >= :quantity
            """)
    int decrementStockIfAvailable(@Param("id") Long id, @Param("quantity") int quantity);

    /**
     * Atomic stock increment — used to restore stock on order cancellation/expiry.
     */
    @Modifying
    @Query("UPDATE Product p SET p.stock = p.stock + :quantity, p.version = p.version + 1 WHERE p.id = :id")
    void incrementStock(@Param("id") Long id, @Param("quantity") int quantity);
}
