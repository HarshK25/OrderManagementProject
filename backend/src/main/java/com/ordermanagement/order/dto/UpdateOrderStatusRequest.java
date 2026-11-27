package com.ordermanagement.order.dto;

import com.ordermanagement.order.entity.OrderStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateOrderStatusRequest {

    @NotNull(message = "Status is required")
    private OrderStatus status;

    /** Optional note explaining the transition (e.g. "Dispatched via BlueDart"). */
    private String note;

    /** Optional estimated delivery date set or updated by admin */
    private java.time.LocalDate estimatedDeliveryDate;

    /** Optional shipment tracking number */
    private String trackingNumber;

    /** Optional shipping carrier (e.g. BlueDart, Delhivery) */
    private String carrier;
}
