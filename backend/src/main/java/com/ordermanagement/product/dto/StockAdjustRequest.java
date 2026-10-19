package com.ordermanagement.product.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockAdjustRequest {
    /** Positive to add stock, negative to remove. Applied atomically. */
    @NotNull(message = "Delta is required")
    private Integer delta;
}
