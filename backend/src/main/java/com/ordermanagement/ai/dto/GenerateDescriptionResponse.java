package com.ordermanagement.ai.dto;

/**
 * Response returned by the AI description generator endpoint.
 * Keeps the contract simple: just the generated text.
 */
public record GenerateDescriptionResponse(String description) {}

