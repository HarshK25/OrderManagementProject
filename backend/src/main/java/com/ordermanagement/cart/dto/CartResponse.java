package com.ordermanagement.cart.dto;

import com.ordermanagement.cart.entity.Cart;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Full cart view with computed totals.
 *
 * totalItems   — sum of all quantities across all line items
 * totalAmount  — sum of (effectivePrice × quantity) for each line item
 *
 * These are computed server-side so the frontend never has to re-implement
 * the discount calculation and the values are always consistent.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartResponse {

    private Long cartId;
    private List<CartItemResponse> items;

    /** Total number of individual units in the cart. */
    private int totalItems;
    /** Grand total after all discounts. */
    private BigDecimal totalAmount;

    public static CartResponse from(Cart cart) {
        List<CartItemResponse> itemResponses = cart.getItems()
                .stream()
                .map(CartItemResponse::from)
                .toList();

        int totalItems = itemResponses.stream()
                .mapToInt(CartItemResponse::getQuantity)
                .sum();

        BigDecimal totalAmount = itemResponses.stream()
                .map(CartItemResponse::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CartResponse.builder()
                .cartId(cart.getId())
                .items(itemResponses)
                .totalItems(totalItems)
                .totalAmount(totalAmount)
                .build();
    }
}
