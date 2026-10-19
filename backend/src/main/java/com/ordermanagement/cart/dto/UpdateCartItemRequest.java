package com.ordermanagement.cart.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateCartItemRequest {

    /**
     * New absolute quantity for this item.
     * Setting to 0 removes the item from the cart.
     */
    @NotNull(message = "Quantity is required")
    @Min(value = 0, message = "Quantity cannot be negative")
    @Max(value = 99, message = "Cannot have more than 99 of the same item")
    private Integer quantity;
}
