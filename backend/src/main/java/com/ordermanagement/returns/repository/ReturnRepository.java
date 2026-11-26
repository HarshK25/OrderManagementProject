package com.ordermanagement.returns.repository;

import com.ordermanagement.returns.entity.ReturnRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReturnRepository extends JpaRepository<ReturnRequest, Long> {

    Optional<ReturnRequest> findByOrderId(Long orderId);

    boolean existsByOrderId(Long orderId);

    /** Admin: all returns with their orders eagerly loaded to avoid N+1. */
    @Query("SELECT r FROM ReturnRequest r JOIN FETCH r.order o JOIN FETCH o.user")
    List<ReturnRequest> findAllWithOrder();
}

