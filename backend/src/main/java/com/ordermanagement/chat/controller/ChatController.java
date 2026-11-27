package com.ordermanagement.chat.controller;

import com.ordermanagement.chat.dto.ChatRequest;
import com.ordermanagement.chat.dto.ChatResponse;
import com.ordermanagement.chat.service.ChatbotService;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Public + authenticated actionable chatbot endpoint.
 * When a JWT is present, the chatbot has live access to the customer's
 * orders, cart, and active coupons, and can add products to their cart.
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Tag(name = "Chat", description = "Actionable AI customer support chatbot")
public class ChatController {

    private final ChatbotService chatbotService;

    @PostMapping("/message")
    @Operation(summary = "Send a message to the actionable AI shopping assistant")
    public ChatResponse sendMessage(
            @Valid @RequestBody ChatRequest request,
            @AuthenticationPrincipal User currentUser) {
        return chatbotService.chat(request, currentUser);
    }
}
