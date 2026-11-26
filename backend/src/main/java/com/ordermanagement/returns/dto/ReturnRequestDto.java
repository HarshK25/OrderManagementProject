package com.ordermanagement.returns.dto;

import com.ordermanagement.returns.entity.ItemCondition;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReturnRequestDto(
        @NotBlank @Size(min = 10, max = 1000) String reason,
        @NotNull ItemCondition itemCondition
) {}

