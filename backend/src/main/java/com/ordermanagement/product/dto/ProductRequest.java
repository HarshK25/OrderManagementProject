package com.ordermanagement.product.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductRequest {

    @NotBlank(message = "Product name is required")
    @Size(max = 255, message = "Name must not exceed 255 characters")
    private String name;

    private String description;

    /** Null means no category. */
    private Long categoryId;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.01", message = "Price must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Price must have at most 2 decimal places")
    private BigDecimal price;

    @DecimalMin(value = "0.00", message = "Discount cannot be negative")
    @DecimalMax(value = "90.00", message = "Discount cannot exceed 90%")
    @Digits(integer = 3, fraction = 2, message = "Discount must have at most 2 decimal places")
    private BigDecimal discountPercent = BigDecimal.ZERO;

    @Min(value = 0, message = "Stock cannot be negative")
    private int stock = 0;

    @Size(max = 500, message = "Image URL must not exceed 500 characters")
    private String imageUrl;

    private boolean active = true;
}
