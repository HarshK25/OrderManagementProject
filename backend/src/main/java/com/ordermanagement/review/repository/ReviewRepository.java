package com.ordermanagement.review.repository;

import com.ordermanagement.review.entity.ProductReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<ProductReview, Long> {

    /** Paginated reviews for a product — newest first. */
    @Query("SELECT r FROM ProductReview r JOIN FETCH r.user WHERE r.product.id = :productId ORDER BY r.createdAt DESC")
    Page<ProductReview> findByProductId(@Param("productId") Long productId, Pageable pageable);

    /** Check if user already reviewed this product. */
    boolean existsByUserIdAndProductId(Long userId, Long productId);

    /** Find existing review to allow edit. */
    Optional<ProductReview> findByUserIdAndProductId(Long userId, Long productId);

    /** Average rating for a product. */
    @Query("SELECT COALESCE(AVG(CAST(r.rating AS double)), 0.0) FROM ProductReview r WHERE r.product.id = :productId")
    Double avgRatingByProductId(@Param("productId") Long productId);

    /** Total review count for a product. */
    long countByProductId(Long productId);

    /** Rating distribution (1–5 star counts) for a product. */
    @Query("SELECT r.rating, COUNT(r) FROM ProductReview r WHERE r.product.id = :productId GROUP BY r.rating ORDER BY r.rating DESC")
    java.util.List<Object[]> ratingDistributionByProductId(@Param("productId") Long productId);

    /** Check user reviewed via a specific order. */
    boolean existsByUserIdAndOrderId(Long userId, Long orderId);
}

