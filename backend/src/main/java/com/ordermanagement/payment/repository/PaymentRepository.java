package com.ordermanagement.payment.repository;

import com.ordermanagement.order.entity.Order;
import com.ordermanagement.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /** Used by the idempotency guard to detect duplicate payment verifications. */
    Optional<Payment> findByRazorpayPaymentId(String razorpayPaymentId);

    /** Find the pending payment created by POST /api/payments/create/{orderId}. */
    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);

    /** Delete all payment records for an order (called before order deletion to satisfy FK). */
    void deleteByOrder(Order order);

    /** Find the verified (SUCCESS) payment for a given order — used for Razorpay refunds. */
    Optional<Payment> findByOrderIdAndStatus(Long orderId, com.ordermanagement.payment.entity.PaymentStatus status);
}
