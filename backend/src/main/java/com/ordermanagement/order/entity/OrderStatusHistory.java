package com.ordermanagement.order.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Append-only audit log of every order status change.
 *
 * This table is intentionally NOT updated — rows are inserted once and
 * never modified, providing a reliable audit trail / customer-facing timeline.
 *
 * Does NOT extend BaseEntity because it has a single timestamp column
 * (changed_at) rather than created_at + updated_at.
 */
@Entity
@Table(name = "order_status_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** Null only for the very first history row (order was just created). */
    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30)
    private OrderStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30)
    private OrderStatus toStatus;

    /** Human-readable reason for the transition (optional). */
    @Column(length = 500)
    private String note;

    /** Email of the actor or "system" for automated transitions. */
    @Column(name = "changed_by", length = 100)
    private String changedBy;

    @Column(name = "changed_at", nullable = false)
    @Builder.Default
    private LocalDateTime changedAt = LocalDateTime.now();
}
