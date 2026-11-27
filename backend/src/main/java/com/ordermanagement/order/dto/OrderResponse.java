package com.ordermanagement.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ordermanagement.order.entity.Order;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderResponse {

    private Long id;
    private String orderNumber;
    private String status;

    private List<OrderItemResponse> items;

    // ── Pricing breakdown ─────────────────────────────────────────────
    private BigDecimal subtotal;      // sum of original prices
    private BigDecimal discountTotal; // total discount applied
    private BigDecimal total;         // amount to pay (subtotal - discountTotal)

    // ── Shipping snapshot ──────────────────────────────────────────────
    private String shippingName;
    private String shippingPhone;
    private String shippingAddress;
    private String shippingCity;
    private String shippingState;
    private String shippingPincode;

    /** Payment deadline — visible while PENDING_PAYMENT. */
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;

    /** Estimated dispatch date (e.g. order date + 1 day) */
    private java.time.LocalDate estimatedShipDate;

    /** Estimated delivery date (e.g. order date + 4 days, or admin override) */
    private java.time.LocalDate estimatedDeliveryDate;

    /** Exact timestamp when order was shipped */
    private LocalDateTime shippedAt;

    /** Exact timestamp when order was delivered */
    private LocalDateTime deliveredAt;

    private String paymentMethod;
    private String couponCode;
    private BigDecimal couponDiscount;
    private String trackingNumber;
    private String carrier;

    /** Full audit trail — included in detail views, null in list views. */
    private List<OrderStatusHistoryResponse> statusHistory;

    // ── Summary factory (for list endpoints — no history) ─────────────
    public static OrderResponse summary(Order o) {
        return OrderResponse.builder()
                .id(o.getId())
                .orderNumber(o.getOrderNumber())
                .status(o.getStatus().name())
                .subtotal(o.getSubtotal())
                .discountTotal(o.getDiscountTotal())
                .total(o.getTotal())
                .shippingName(o.getShippingName())
                .shippingCity(o.getShippingCity())
                .shippingState(o.getShippingState())
                .expiresAt(o.getExpiresAt())
                .createdAt(o.getCreatedAt())
                .estimatedShipDate(o.getEstimatedShipDate())
                .estimatedDeliveryDate(o.getEstimatedDeliveryDate())
                .shippedAt(o.getShippedAt())
                .deliveredAt(o.getDeliveredAt())
                .paymentMethod(o.getPaymentMethod())
                .couponCode(o.getCouponCode())
                .couponDiscount(o.getCouponDiscount())
                .trackingNumber(o.getTrackingNumber())
                .carrier(o.getCarrier())
                .build();
    }

    // ── Detail factory (for single order view — includes items + history) ──
    public static OrderResponse detail(Order o) {
        List<OrderItemResponse> items = o.getItems().stream()
                .map(OrderItemResponse::from).toList();
        List<OrderStatusHistoryResponse> history = o.getStatusHistory().stream()
                .map(OrderStatusHistoryResponse::from).toList();

        return OrderResponse.builder()
                .id(o.getId())
                .orderNumber(o.getOrderNumber())
                .status(o.getStatus().name())
                .items(items)
                .subtotal(o.getSubtotal())
                .discountTotal(o.getDiscountTotal())
                .total(o.getTotal())
                .shippingName(o.getShippingName())
                .shippingPhone(o.getShippingPhone())
                .shippingAddress(o.getShippingAddress())
                .shippingCity(o.getShippingCity())
                .shippingState(o.getShippingState())
                .shippingPincode(o.getShippingPincode())
                .expiresAt(o.getExpiresAt())
                .createdAt(o.getCreatedAt())
                .estimatedShipDate(o.getEstimatedShipDate())
                .estimatedDeliveryDate(o.getEstimatedDeliveryDate())
                .shippedAt(o.getShippedAt())
                .deliveredAt(o.getDeliveredAt())
                .paymentMethod(o.getPaymentMethod())
                .couponCode(o.getCouponCode())
                .couponDiscount(o.getCouponDiscount())
                .trackingNumber(o.getTrackingNumber())
                .carrier(o.getCarrier())
                .statusHistory(history)
                .build();
    }
}
