package com.ordermanagement.payment.repository;

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
}
