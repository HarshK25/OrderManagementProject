package com.ordermanagement.chat.dto;

/**
 * Response from the chatbot endpoint.
 *
 * sessionId – echo back (or newly created) session identifier.
 * reply     – The AI-generated reply text.
 */
public record ChatResponse(String sessionId, String reply) {}

