package com.ordermanagement.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Request body for the AI description generator.
 * The admin supplies name, category, price, and optional keywords.
 * Everything else (tone, length, format) is controlled by the prompt template.
 */
public record GenerateDescriptionRequest(

        @NotBlank(message = "Product name is required")
        String name,

        String category,

        @NotNull(message = "Price is required")
        @Positive(message = "Price must be positive")
        BigDecimal price,

        Integer discountPercent,   // optional – 0 means no discount
        String keywords            // optional – comma-separated hints, e.g. "lightweight, waterproof"
) {}

