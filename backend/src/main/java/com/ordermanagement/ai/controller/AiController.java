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
    private final com.ordermanagement.ai.service.AiInsightsService aiInsightsService;
    private final com.ordermanagement.ai.service.AiCommerceService aiCommerceService;

    @PostMapping("/generate-description")
    @Operation(summary = "Generate a product description using AI (admin only)")
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

    @PostMapping("/assistant")
    @Operation(summary = "Ask the Admin AI Insights Assistant about live orders, sales, and inventory")
    public ResponseEntity<Map<String, Object>> askAssistant(@RequestBody Map<String, String> body) {
        String question = body.getOrDefault("question", "Summarize store performance");
        return ResponseEntity.ok(aiInsightsService.askAssistant(question));
    }

    @GetMapping("/returns-analysis")
    @Operation(summary = "Cluster return reasons and detect repeat cancellation/return risk accounts")
    public ResponseEntity<Map<String, Object>> analyzeReturns() {
        return ResponseEntity.ok(aiCommerceService.analyzeReturnsAndRisk());
    }

    @PostMapping("/draft-notification")
    @Operation(summary = "Draft a personalized AI customer notification/email for an order")
    public ResponseEntity<Map<String, Object>> draftNotification(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(body.get("orderId").toString());
        String scenario = body.getOrDefault("scenario", "ORDER_UPDATE").toString();
        return ResponseEntity.ok(aiCommerceService.draftCustomerNotification(orderId, scenario));
    }

    @PostMapping("/send-notification")
    @Operation(summary = "Send an AI-drafted in-app notification (and optional email) to the order's customer")
    public ResponseEntity<Map<String, Object>> sendNotification(@RequestBody Map<String, Object> body) {
        Long orderId = Long.valueOf(body.get("orderId").toString());
        String title = body.getOrDefault("title", "").toString();
        String message = body.getOrDefault("message", "").toString();
        boolean sendEmail = Boolean.TRUE.equals(body.get("sendEmail"));
        return ResponseEntity.ok(aiCommerceService.sendCustomerNotification(orderId, title, message, sendEmail));
    }
}

