package com.ordermanagement.chat.service;

import com.ordermanagement.chat.dto.ChatRequest;
import com.ordermanagement.chat.dto.ChatResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AI-powered customer support chatbot service.
 *
 * Uses Groq's OpenAI-compatible API to generate conversational responses.
 * Maintains per-session conversation history (last 20 messages = 10 turns).
 * Sessions are stored in-memory — they reset on server restart (suitable for MVP).
 */
@Service
@Slf4j
public class ChatbotService {

    private static final String GROQ_BASE_URL  = "https://api.groq.com";
    private static final String GROQ_MODEL     = "openai/gpt-oss-20b";
    private static final int    MAX_HISTORY    = 20;   // 10 user + 10 assistant turns
    private static final int    MAX_TOKENS     = 400;

    private static final String SYSTEM_PROMPT  = """
            You are a friendly and helpful customer support assistant for an Indian e-commerce store.
            
            Store details:
            - Name: Order Management Store
            - Products: Electronics, Accessories, Clothing, Home & Kitchen, Sports
            - Payment methods: Razorpay (UPI, credit/debit cards, net banking, wallets)
            - Shipping: Standard 3-7 business days, express available
            - Return policy: 7-day return window for most items; item must be unused and in original packaging
            - Support email: support@ordermanagement.com
            - Support phone: +91 98765 43210 (available Mon–Sat, 9 AM – 7 PM IST)
            - WhatsApp support: +91 98765 43210
            
            Your capabilities:
            - Answer product and category questions
            - Explain payment options (Razorpay, UPI, cards)
            - Explain the return and refund process
            - Guide users to track orders (tell them to visit "My Orders" page after logging in)
            - Help with general shopping questions
            - Provide contact details when customers want to reach a human agent
            
            Rules:
            - Be concise — 1-3 sentences unless more detail is genuinely needed
            - Be warm and professional with Indian shoppers
            - Never make up specific order details — always direct users to log in and check "My Orders"
            - When a customer asks to speak to someone, contact support, or needs human help,
              always provide: phone +91 98765 43210, WhatsApp +91 98765 43210, and email support@ordermanagement.com
            - If asked about something outside your scope, politely say you can help with shopping-related questions
            - Respond in English
            """;

    private final WebClient webClient;

    @Value("${GROQ_API_KEY:}")
    private String groqApiKey;

    // sessionId → list of {role, content} maps
    private final Map<String, List<Map<String, String>>> sessions = new ConcurrentHashMap<>();

    public ChatbotService() {
        this.webClient = WebClient.builder()
                .baseUrl(GROQ_BASE_URL)
                .build();
    }

    public ChatResponse chat(ChatRequest request) {
        // Create a new session ID if none provided
        String sessionId = (request.sessionId() != null && !request.sessionId().isBlank())
                ? request.sessionId()
                : UUID.randomUUID().toString();

        // Get or initialize session history
        List<Map<String, String>> history = sessions.computeIfAbsent(sessionId, k -> new ArrayList<>());

        // Add user message to history
        history.add(Map.of("role", "user", "content", request.message()));

        // Build full messages list: system + history
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", SYSTEM_PROMPT));
        messages.addAll(history);

        // Call Groq API
        String reply = callGroq(messages);

        // Add assistant reply to history
        history.add(Map.of("role", "assistant", "content", reply));

        // Trim history to last MAX_HISTORY messages to avoid token overflow
        if (history.size() > MAX_HISTORY) {
            history.subList(0, history.size() - MAX_HISTORY).clear();
        }

        return new ChatResponse(sessionId, reply);
    }

    private String callGroq(List<Map<String, String>> messages) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            throw new IllegalStateException("GROQ_API_KEY is not configured.");
        }

        Map<String, Object> body = Map.of(
                "model",       GROQ_MODEL,
                "max_tokens",  MAX_TOKENS,
                "temperature", 0.75,
                "messages",    messages
        );

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.post()
                    .uri("/openai/v1/chat/completions")
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            return ((String) message.get("content")).trim();

        } catch (WebClientResponseException ex) {
            log.error("Groq chatbot error {}: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            return "Sorry, I'm having trouble connecting right now. Please try again in a moment or contact support@ordermanagement.com.";
        } catch (Exception ex) {
            log.error("Chatbot unexpected error: {}", ex.getMessage(), ex);
            return "Sorry, something went wrong. Please try again or contact support@ordermanagement.com.";
        }
    }
}

