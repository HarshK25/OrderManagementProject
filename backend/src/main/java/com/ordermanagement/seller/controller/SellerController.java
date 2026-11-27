package com.ordermanagement.seller.controller;

import com.ordermanagement.ai.dto.GenerateDescriptionRequest;
import com.ordermanagement.ai.dto.GenerateDescriptionResponse;
import com.ordermanagement.product.dto.ProductRequest;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.seller.service.SellerService;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Seller Hub", description = "Become a Seller onboarding and Seller product management")
@SecurityRequirement(name = "bearerAuth")
public class SellerController {

    private final SellerService sellerService;

    @GetMapping("/api/seller/me")
    @Operation(summary = "Get current user's seller profile, KPI stats, and product listings")
    public Map<String, Object> myDashboard(@AuthenticationPrincipal User user) {
        return sellerService.getMySellerDashboard(user);
    }

    @PostMapping("/api/seller/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register as a seller on ShopVerse")
    public Map<String, Object> register(@AuthenticationPrincipal User user,
                                        @RequestBody Map<String, Object> body) {
        return sellerService.registerSeller(user, body);
    }

    @PostMapping("/api/seller/products")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "List a new product under the seller's store")
    public ProductResponse createProduct(@AuthenticationPrincipal User user,
                                         @Valid @RequestBody ProductRequest request) {
        return sellerService.createSellerProduct(user, request);
    }

    @PatchMapping("/api/seller/products/{id}/stock")
    @Operation(summary = "Update stock quantity for a seller's product")
    public ProductResponse updateStock(@AuthenticationPrincipal User user,
                                       @PathVariable Long id,
                                       @RequestBody Map<String, Object> body) {
        int stock = Integer.parseInt(body.get("stock").toString());
        return sellerService.updateSellerProductStock(user, id, stock);
    }

    @PatchMapping("/api/seller/products/{id}/toggle-active")
    @Operation(summary = "Pause or resume a seller's product listing")
    public ProductResponse toggleActive(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return sellerService.toggleSellerProduct(user, id);
    }

    @PostMapping("/api/seller/ai/generate-description")
    @Operation(summary = "Generate an AI product description for a seller listing")
    public GenerateDescriptionResponse generateDescription(@AuthenticationPrincipal User user,
                                                           @Valid @RequestBody GenerateDescriptionRequest request) {
        return new GenerateDescriptionResponse(sellerService.generateSellerDescription(user, request));
    }

    // ── Admin seller management ───────────────────────────────────────

    @GetMapping("/api/admin/sellers")
    @Operation(summary = "List all registered sellers (admin)")
    public List<Map<String, Object>> listAllSellers() {
        return sellerService.listAllSellers();
    }

    @PatchMapping("/api/admin/sellers/{id}/status")
    @Operation(summary = "Approve, suspend, or reject a seller account (admin)")
    public Map<String, Object> updateSellerStatus(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body) {
        return sellerService.updateSellerStatus(id, body.get("status"), body.get("adminNote"));
    }
}
