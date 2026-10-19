package com.ordermanagement.order.repository;

import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    /** Customer: paginated list of own orders, newest first. */
    Page<Order> findByUser(User user, Pageable pageable);

    /** Admin: filter by status (null = all). */
    Page<Order> findByStatus(OrderStatus status, Pageable pageable);

    /**
     * Fetch order with items JOIN FETCHed in one query.
     * statusHistory loads lazily within the same @Transactional context.
     *
     * Hibernate MultipleBagFetchException prevents JOIN FETCHing two List
     * collections simultaneously. Items (needed for price display) are eagerly
     * fetched; statusHistory (audit trail) loads lazily on first access.
     */
    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.items i
            LEFT JOIN FETCH i.product
            WHERE o.id = :id
            """)
    Optional<Order> findByIdWithDetails(@Param("id") Long id);

    /**
     * Customer-safe lookup — validates the order belongs to the given user
     * before returning it (prevents IDOR).
     */
    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.items i
            LEFT JOIN FETCH i.product
            WHERE o.id = :id AND o.user = :user
            """)
    Optional<Order> findByIdAndUserWithDetails(@Param("id") Long id,
                                               @Param("user") User user);

    /** Sequential order number generation helper. */
    long countByOrderNumberStartingWith(String prefix);
}
