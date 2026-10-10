package com.ordermanagement.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Email idempotency guard.
 *
 * Before processing an email event, the consumer tries to insert a row here.
 * If the row already exists (primary key conflict), the event was already
 * processed and the consumer skips it silently — exactly-once email delivery.
 *
 * event_id format: "<event-type>:<order-id>:<uuid>" — see NotificationService.
 *
 * Rows here are permanent (no TTL cleanup in this build). For production you
 * would add a scheduled job to delete rows older than 30 days.
 */
@Entity
@Table(name = "processed_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProcessedEvent {

    /** Composite semantic key — no surrogate ID needed. */
    @Id
    @Column(name = "event_id", length = 100)
    private String eventId;

    @Column(name = "processed_at", nullable = false)
    @Builder.Default
    private LocalDateTime processedAt = LocalDateTime.now();
}
