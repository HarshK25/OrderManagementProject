package com.ordermanagement.ai.service;

import com.ordermanagement.ai.dto.GenerateDescriptionRequest;
import com.ordermanagement.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Calls the Groq API (OpenAI-compatible) to produce a product description.
 * Groq is free (14,400 requests/day) and very fast.
 *
 * API docs: https://console.groq.com/docs/openai
 * Endpoint: POST https://api.groq.com/openai/v1/chat/completions
 * Auth:     Authorization: Bearer gsk_...
 */
@Service
@Slf4j
public class GeminiService {

    private static final String GROQ_BASE_URL = "https://api.groq.com";

    private final WebClient webClient;
    private final AppProperties props;

    public GeminiService(AppProperties props) {
        this.props = props;
        this.webClient = WebClient.builder()
                .baseUrl(GROQ_BASE_URL)
                .build();
    }

    public String generateDescription(GenerateDescriptionRequest request) {
        String prompt = buildPrompt(request);
        log.debug("Calling Groq API for product: {}", request.name());

        String apiKey = props.getGroq().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "Groq API key is not configured. Set GROQ_API_KEY in your .env file.");
        }

        // OpenAI-compatible chat completions request body
        Map<String, Object> requestBody = Map.of(
                "model",       "openai/gpt-oss-20b",
                "max_tokens",  300,
                "temperature", 0.7,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.post()
                    .uri("/openai/v1/chat/completions")
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            return extractText(response);

        } catch (WebClientResponseException ex) {
            String groqError = ex.getResponseBodyAsString();
            log.error("Groq API error {}: {}", ex.getStatusCode(), groqError);
            throw new RuntimeException("Groq error " + ex.getStatusCode() + ": " + groqError, ex);
        } catch (Exception ex) {
            log.error("Unexpected AI error: {}", ex.getMessage(), ex);
            throw new RuntimeException("AI error: " + ex.getMessage(), ex);
        }
    }

    /**
     * Generates 4 concise review suggestions (title + body) for a customer writing a product review.
     * Falls back cleanly to rating-appropriate templates if Groq is unavailable.
     */
    public List<Map<String, String>> suggestReviewDrafts(String productName, int rating, String draft) {
        int safeRating = Math.max(1, Math.min(5, rating));
        String apiKey = props.getGroq() != null ? props.getGroq().getApiKey() : null;
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                String prompt = """
                        Generate 4 short, natural customer product review suggestions for "%s" with a %d-star rating.
                        %s
                        Return ONLY 4 lines in the exact format:
                        Title | Review body (1-2 sentences)
                        No numbering, no markdown, no extra commentary.
                        """.formatted(
                        productName,
                        safeRating,
                        (draft != null && !draft.isBlank()) ? "Customer's partial draft: \"" + draft + "\"" : ""
                );

                Map<String, Object> requestBody = Map.of(
                        "model", "openai/gpt-oss-20b",
                        "max_tokens", 320,
                        "temperature", 0.7,
                        "messages", List.of(Map.of("role", "user", "content", prompt))
                );

                @SuppressWarnings("unchecked")
                Map<String, Object> response = webClient.post()
                        .uri("/openai/v1/chat/completions")
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + apiKey)
                        .bodyValue(requestBody)
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block();

                String text = extractText(response);
                List<Map<String, String>> parsed = new java.util.ArrayList<>();
                for (String line : text.split("\n")) {
                    String trimmed = line.replaceAll("^[0-9.\\-*\\s]+", "").trim();
                    if (trimmed.contains("|")) {
                        String[] parts = trimmed.split("\\|", 2);
                        String t = parts[0].trim();
                        String b = parts[1].trim();
                        if (!t.isEmpty() && !b.isEmpty()) {
                            parsed.add(Map.of("title", t, "body", b));
                        }
                    }
                }
                if (!parsed.isEmpty()) {
                    return parsed.subList(0, Math.min(4, parsed.size()));
                }
            } catch (Exception ex) {
                log.warn("AI review suggestion call failed, using fallback: {}", ex.getMessage());
            }
        }

        // Deterministic rating-aware fallback
        if (safeRating >= 4) {
            return List.of(
                    Map.of("title", "Great value and quality", "body", "Really happy with " + productName + ". Build quality feels solid and delivery was quick."),
                    Map.of("title", "Exactly as described", "body", productName + " matches the photos and works smoothly right out of the box."),
                    Map.of("title", "Highly recommended", "body", "Been using " + productName + " daily and it has exceeded my expectations for the price."),
                    Map.of("title", "Smooth delivery and nice packaging", "body", "Arrived well-packed and on time. Very satisfied with the purchase.")
            );
        } else if (safeRating == 3) {
            return List.of(
                    Map.of("title", "Decent for the price", "body", productName + " works fine for basic use, though a few details could be better."),
                    Map.of("title", "Good overall, minor flaws", "body", "Delivery was smooth and the product is usable, but the finish is average."),
                    Map.of("title", "Meets basic expectations", "body", "Does the job well enough, nothing extraordinary but fair value."),
                    Map.of("title", "Okay experience", "body", "Received " + productName + " on time. Performance is acceptable for everyday needs.")
            );
        } else {
            return List.of(
                    Map.of("title", "Not what I expected", "body", "The quality of " + productName + " did not match my expectations for the price."),
                    Map.of("title", "Needs improvement", "body", "Faced a few issues right after unboxing. Hoping for better quality control."),
                    Map.of("title", "Below average quality", "body", "Packaging was fine, but the product itself feels underwhelming."),
                    Map.of("title", "Disappointed with purchase", "body", "Would not recommend " + productName + " based on my experience so far.")
            );
        }
    }

    private String buildPrompt(GenerateDescriptionRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("Write a compelling, SEO-friendly product description for an Indian e-commerce store.\n\n");
        sb.append("Product details:\n");
        sb.append("  Name: ").append(req.name()).append("\n");

        if (req.category() != null && !req.category().isBlank()) {
            sb.append("  Category: ").append(req.category()).append("\n");
        }

        sb.append("  Price: ₹").append(req.price().toPlainString()).append("\n");

        if (req.discountPercent() != null && req.discountPercent() > 0) {
            BigDecimal discounted = req.price()
                    .multiply(BigDecimal.valueOf(100 - req.discountPercent()))
                    .divide(BigDecimal.valueOf(100));
            sb.append("  Discount: ").append(req.discountPercent())
              .append("% off (effective price: ₹").append(discounted.toPlainString()).append(")\n");
        }

        if (req.keywords() != null && !req.keywords().isBlank()) {
            sb.append("  Keywords/features: ").append(req.keywords()).append("\n");
        }

        sb.append("\nRequirements:\n");
        sb.append("  - 2 to 3 sentences only\n");
        sb.append("  - Highlight key benefits and use cases\n");
        sb.append("  - Professional, friendly tone suitable for Indian shoppers\n");
        sb.append("  - End with a value proposition or call to action\n");
        sb.append("  - Do NOT include the price in the description\n");
        sb.append("  - Return ONLY the description text, no headings, no markdown, no extra commentary\n");

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map<String, Object> response) {
        try {
            // OpenAI response shape: { choices: [ { message: { content: "..." } } ] }
            List<Map<String, Object>> choices =
                    (List<Map<String, Object>>) response.get("choices");
            Map<String, Object> message =
                    (Map<String, Object>) choices.get(0).get("message");
            return ((String) message.get("content")).trim();
        } catch (Exception e) {
            log.error("Failed to parse Groq response: {}", response);
            throw new RuntimeException("Failed to parse AI response. Please try again.");
        }
    }
}
