package com.ordermanagement.payment.entity;

import com.ordermanagement.common.entity.BaseEntity;
import com.ordermanagement.order.entity.Order;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Razorpay payment record.
 *
 * Idempotency is enforced by the UNIQUE constraint on razorpay_payment_id.
 * If a duplicate verify call arrives, the insert will fail with a unique violation
 * which the service catches and treats as a no-op (already processed).
 *
 * razorpayPaymentId is null until the payment is verified — it is populated only
 * after POST /api/payments/verify succeeds.
 */
@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** Razorpay's own order ID returned from createOrder(). */
    @Column(name = "razorpay_order_id", nullable = false, length = 100)
    private String razorpayOrderId;

    /** Null until payment verified. UNIQUE — idempotency guard. */
    @Column(name = "razorpay_payment_id", unique = true, length = 100)
    private String razorpayPaymentId;

    /** Amount in INR (not paise). */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PaymentStatus status;

    @Column(name = "payment_method", nullable = false, length = 30)
    @Builder.Default
    private String paymentMethod = "ONLINE";
}
