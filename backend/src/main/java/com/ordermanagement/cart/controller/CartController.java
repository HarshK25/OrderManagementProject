package com.ordermanagement.cart.controller;

import com.ordermanagement.cart.dto.AddToCartRequest;
import com.ordermanagement.cart.dto.CartResponse;
import com.ordermanagement.cart.dto.UpdateCartItemRequest;
import com.ordermanagement.cart.service.CartService;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Cart endpoints — all require authentication.
 *
 * ┌────────────────────────────────────────────────────────┐
 * │ Method │ Path                        │ Description     │
 * ├────────────────────────────────────────────────────────┤
 * │ GET    │ /api/cart                   │ View cart       │
 * │ POST   │ /api/cart/items             │ Add item        │
 * │ PUT    │ /api/cart/items/{productId} │ Update quantity │
 * │ DELETE │ /api/cart/items/{productId} │ Remove item     │
 * │ DELETE │ /api/cart                   │ Clear cart      │
 * └────────────────────────────────────────────────────────┘
 *
 * All responses return the full updated CartResponse so the client
 * never needs a separate GET after a mutation.
 */
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
@Tag(name = "Cart", description = "Shopping cart management")
@SecurityRequirement(name = "bearerAuth")
public class CartController {

    private final CartService cartService;

    @GetMapping
    @Operation(summary = "Get the current user's cart (empty cart if none exists)")
    public CartResponse getCart(@AuthenticationPrincipal User user) {
        return cartService.getCart(user);
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a product to the cart (increments quantity if already present)")
    public CartResponse addItem(@AuthenticationPrincipal User user,
                                @Valid @RequestBody AddToCartRequest request) {
        return cartService.addItem(user, request);
    }

    @PutMapping("/items/{productId}")
    @Operation(summary = "Set absolute quantity for a cart item (0 removes the item)")
    public CartResponse updateItem(@AuthenticationPrincipal User user,
                                   @PathVariable Long productId,
                                   @Valid @RequestBody UpdateCartItemRequest request) {
        return cartService.updateItem(user, productId, request);
    }

    @DeleteMapping("/items/{productId}")
    @Operation(summary = "Remove a product from the cart")
    public CartResponse removeItem(@AuthenticationPrincipal User user,
                                   @PathVariable Long productId) {
        return cartService.removeItem(user, productId);
    }

    @DeleteMapping
    @Operation(summary = "Remove all items from the cart")
    public CartResponse clearCart(@AuthenticationPrincipal User user) {
        return cartService.clearCart(user);
    }
}
