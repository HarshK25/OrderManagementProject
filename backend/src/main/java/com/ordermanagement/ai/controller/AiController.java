package com.ordermanagement.ai.controller;

import com.ordermanagement.ai.dto.GenerateDescriptionRequest;
import com.ordermanagement.ai.dto.GenerateDescriptionResponse;
import com.ordermanagement.ai.service.GeminiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin-only AI endpoint.
 *
 * POST /api/admin/ai/generate-description
 *   – Takes product metadata (name, category, price, keywords)
 *   – Calls Gemini via GeminiService
 *   – Returns the generated description text
 *
 * Secured by /api/admin/** → ADMIN role in SecurityFilterChain.
 * API key never leaves the server.
 */
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin – AI", description = "AI-powered tools for admins")
@SecurityRequirement(name = "bearerAuth")
public class AiController {

    private final GeminiService geminiService;

    @PostMapping("/generate-description")
    @Operation(summary = "Generate a product description using Gemini AI (admin only)")
    public ResponseEntity<?> generateDescription(
            @Valid @RequestBody GenerateDescriptionRequest request) {
        try {
            String description = geminiService.generateDescription(request);
            return ResponseEntity.ok(new GenerateDescriptionResponse(description));
        } catch (Exception ex) {
            log.error("AI generation failed: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", ex.getMessage() != null ? ex.getMessage() : "AI service error"));
        }
    }
}

