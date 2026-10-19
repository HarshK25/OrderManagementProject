package com.ordermanagement.cart.dto;

import com.ordermanagement.cart.entity.CartItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartItemResponse {

    private Long cartItemId;
    private Long productId;
    private String productName;
    private String imageUrl;

    /** Full (pre-discount) price. */
    private BigDecimal price;
    private BigDecimal discountPercent;
    /** Discounted unit price. */
    private BigDecimal effectivePrice;

    private int quantity;
    /** effectivePrice × quantity */
    private BigDecimal subtotal;

    /** Available stock — lets the UI warn "only N left". */
    private int availableStock;

    public static CartItemResponse from(CartItem item) {
        BigDecimal effectivePrice = item.getProduct().getEffectivePrice();
        BigDecimal subtotal = effectivePrice.multiply(BigDecimal.valueOf(item.getQuantity()));

        return CartItemResponse.builder()
                .cartItemId(item.getId())
                .productId(item.getProduct().getId())
                .productName(item.getProduct().getName())
                .imageUrl(item.getProduct().getImageUrl())
                .price(item.getProduct().getPrice())
                .discountPercent(item.getProduct().getDiscountPercent())
                .effectivePrice(effectivePrice)
                .quantity(item.getQuantity())
                .subtotal(subtotal)
                .availableStock(item.getProduct().getStock())
                .build();
    }
}
