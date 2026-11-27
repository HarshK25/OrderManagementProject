package com.ordermanagement.wishlist.controller;

import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.user.entity.User;
import com.ordermanagement.wishlist.entity.WishlistItem;
import com.ordermanagement.wishlist.repository.WishlistRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
@Tag(name = "Wishlist", description = "Customer wishlist management")
@SecurityRequirement(name = "bearerAuth")
public class WishlistController {

    private final WishlistRepository wishlistRepository;
    private final ProductRepository productRepository;

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(summary = "Get current user's wishlist products")
    public List<ProductResponse> getWishlist(@AuthenticationPrincipal User user) {
        return wishlistRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(item -> ProductResponse.from(item.getProduct()))
                .toList();
    }

    @PostMapping("/{productId}")
    @Transactional
    @Operation(summary = "Toggle a product in the user's wishlist")
    public Map<String, Object> toggleWishlist(@AuthenticationPrincipal User user,
                                              @PathVariable Long productId) {
        if (wishlistRepository.existsByUserIdAndProductId(user.getId(), productId)) {
            wishlistRepository.deleteByUserIdAndProductId(user.getId(), productId);
            return Map.of("wishlisted", false, "productId", productId);
        }
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
        wishlistRepository.save(WishlistItem.builder().user(user).product(product).build());
        return Map.of("wishlisted", true, "productId", productId);
    }

    @DeleteMapping("/{productId}")
    @Transactional
    @Operation(summary = "Remove a product from the user's wishlist")
    public Map<String, Object> removeFromWishlist(@AuthenticationPrincipal User user,
                                                  @PathVariable Long productId) {
        wishlistRepository.deleteByUserIdAndProductId(user.getId(), productId);
        return Map.of("wishlisted", false, "productId", productId);
    }
}
