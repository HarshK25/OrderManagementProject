package com.ordermanagement.payment.controller;

import com.ordermanagement.payment.dto.CreatePaymentResponse;
import com.ordermanagement.payment.dto.PaymentVerifyResponse;
import com.ordermanagement.payment.dto.VerifyPaymentRequest;
import com.ordermanagement.payment.service.PaymentService;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Payment endpoints.
 *
 *  POST /api/payments/create/{orderId}   — create Razorpay order
 *  POST /api/payments/verify             — verify signature and mark order PAID
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Razorpay payment integration")
@SecurityRequirement(name = "bearerAuth")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create/{orderId}")
    @Operation(summary = "Create a Razorpay order for an existing PENDING_PAYMENT order")
    public CreatePaymentResponse createPayment(
            @AuthenticationPrincipal User user,
            @PathVariable Long orderId) {
        return paymentService.createPayment(user, orderId);
    }

    @PostMapping("/verify")
    @Operation(summary = "Verify Razorpay signature and mark order as PAID")
    public PaymentVerifyResponse verifyPayment(
            @Valid @RequestBody VerifyPaymentRequest request) {
        return paymentService.verifyPayment(request);
    }
}
