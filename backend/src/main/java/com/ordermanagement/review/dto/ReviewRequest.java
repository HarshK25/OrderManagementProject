package com.ordermanagement.review.dto;

import jakarta.validation.constraints.*;

public record ReviewRequest(
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 150) String title,
        @Size(max = 2000) String body,
        Long orderId   // optional: auto-resolved to the user's eligible order if omitted
) {}

