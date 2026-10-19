package com.ordermanagement.order.dto;

import com.ordermanagement.order.entity.OrderStatusHistory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusHistoryResponse {
    private String fromStatus;
    private String toStatus;
    private String note;
    private String changedBy;
    private LocalDateTime changedAt;

    public static OrderStatusHistoryResponse from(OrderStatusHistory h) {
        return OrderStatusHistoryResponse.builder()
                .fromStatus(h.getFromStatus() != null ? h.getFromStatus().name() : null)
                .toStatus(h.getToStatus().name())
                .note(h.getNote())
                .changedBy(h.getChangedBy())
                .changedAt(h.getChangedAt())
                .build();
    }
}
