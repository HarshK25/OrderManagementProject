package com.ordermanagement.returns.dto;

import jakarta.validation.constraints.Size;

public record AdminReturnActionDto(
        @Size(max = 1000) String adminNote
) {}

