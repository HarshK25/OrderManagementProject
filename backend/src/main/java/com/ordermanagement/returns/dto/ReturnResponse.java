package com.ordermanagement.returns.dto;

import com.ordermanagement.returns.entity.ItemCondition;
import com.ordermanagement.returns.entity.ReturnRequest;
import com.ordermanagement.order.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ReturnResponse(
        Long id,
        Long orderId,
        String orderNumber,
        String customerName,
        String customerEmail,
        String reason,
        ItemCondition itemCondition,
        OrderStatus returnStatus,   // derived from Order.status
        String adminNote,
        String razorpayRefundId,
        BigDecimal refundAmount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ReturnResponse from(ReturnRequest r) {
        return new ReturnResponse(
                r.getId(),
                r.getOrder().getId(),
                r.getOrder().getOrderNumber(),
                r.getOrder().getUser().getName(),
                r.getOrder().getUser().getEmail(),
                r.getReason(),
                r.getItemCondition(),
                r.getOrder().getStatus(),
                r.getAdminNote(),
                r.getRazorpayRefundId(),
                r.getRefundAmount(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
}

