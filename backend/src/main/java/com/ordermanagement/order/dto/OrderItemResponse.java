package com.ordermanagement.order.dto;

import com.ordermanagement.order.entity.OrderItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemResponse {
    private Long id;
    private Long productId;          // nullable — product may have been deleted
    private String productName;      // snapshot
    private BigDecimal unitPrice;    // snapshot (effective price at time of order)
    private Integer quantity;
    private BigDecimal lineTotal;    // unitPrice × quantity

    public static OrderItemResponse from(OrderItem item) {
        return OrderItemResponse.builder()
                .id(item.getId())
                .productId(item.getProduct() != null ? item.getProduct().getId() : null)
                .productName(item.getProductName())
                .unitPrice(item.getUnitPrice())
                .quantity(item.getQuantity())
                .lineTotal(item.getLineTotal())
                .build();
    }
}
