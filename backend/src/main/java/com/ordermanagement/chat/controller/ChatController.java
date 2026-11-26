package com.ordermanagement.chat.controller;

import com.ordermanagement.chat.dto.ChatRequest;
import com.ordermanagement.chat.dto.ChatResponse;
import com.ordermanagement.chat.service.ChatbotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Public chatbot endpoint — no authentication required.
 *
 * POST /api/chat/message
 *   – Accepts a user message and optional sessionId
 *   – Returns AI reply and sessionId to maintain conversation context
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Tag(name = "Chat", description = "AI customer support chatbot")
public class ChatController {

    private final ChatbotService chatbotService;

    @PostMapping("/message")
    @Operation(summary = "Send a message to the AI customer support chatbot")
    public ChatResponse sendMessage(@Valid @RequestBody ChatRequest request) {
        return chatbotService.chat(request);
    }
}

