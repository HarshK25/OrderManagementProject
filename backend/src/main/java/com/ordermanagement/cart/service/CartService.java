package com.ordermanagement.cart.service;

import com.ordermanagement.cart.dto.AddToCartRequest;
import com.ordermanagement.cart.dto.CartResponse;
import com.ordermanagement.cart.dto.UpdateCartItemRequest;
import com.ordermanagement.cart.entity.Cart;
import com.ordermanagement.cart.entity.CartItem;
import com.ordermanagement.cart.repository.CartItemRepository;
import com.ordermanagement.cart.repository.CartRepository;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.InsufficientStockException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cart business logic.
 *
 * Design decisions:
 *  - Cart is created lazily on first add — we never pre-create carts.
 *  - Stock is validated at add/update time (not reserved). The real reservation
 *    happens atomically in OrderService via a SQL UPDATE with a WHERE guard.
 *  - Setting quantity to 0 on update is a convenience shorthand for "remove".
 *  - An inactive product cannot be added but existing cart items with now-inactive
 *    products stay until the user clears them or places an order (OrderService
 *    validates product state at checkout time).
 */
@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;

    // ── Get cart ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CartResponse getCart(User user) {
        Cart cart = cartRepository.findByUserWithItems(user)
                .orElseGet(() -> Cart.builder().user(user).build());
        // Return empty cart response if no persisted cart yet
        if (cart.getId() == null) {
            return CartResponse.builder()
                    .items(java.util.List.of())
                    .totalItems(0)
                    .totalAmount(java.math.BigDecimal.ZERO)
                    .build();
        }
        return CartResponse.from(cart);
    }

    // ── Add item ──────────────────────────────────────────────────────

    /**
     * Add a product to the cart or increment quantity if already present.
     * Validates:
     *  - Product is active
     *  - Requested total quantity does not exceed available stock
     */
    @Transactional
    public CartResponse addItem(User user, AddToCartRequest request) {
        Product product = productRepository.findByIdWithCategory(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", request.getProductId()));

        if (!product.isActive()) {
            throw new BadRequestException("Product is not available: " + product.getName());
        }

        Cart cart = getOrCreateCart(user);

        // Look for existing line item for this product
        CartItem existing = cartItemRepository
                .findByCartAndProductId(cart, request.getProductId())
                .orElse(null);

        int newQuantity;
        if (existing != null) {
            newQuantity = existing.getQuantity() + request.getQuantity();
            validateStock(product, newQuantity);
            existing.setQuantity(newQuantity);
            cartItemRepository.save(existing);
        } else {
            validateStock(product, request.getQuantity());
            CartItem item = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .quantity(request.getQuantity())
                    .build();
            cart.getItems().add(item);
            cartItemRepository.save(item);
        }

        return CartResponse.from(cartRepository.findByUserWithItems(user).orElseThrow());
    }

    // ── Update item ───────────────────────────────────────────────────

    /**
     * Set absolute quantity for a cart item.
     * quantity == 0 → remove the item (convenience shorthand).
     */
    @Transactional
    public CartResponse updateItem(User user, Long productId, UpdateCartItemRequest request) {
        Cart cart = getCartOrThrow(user);

        if (request.getQuantity() == 0) {
            return removeItemInternal(cart, user, productId);
        }

        CartItem item = cartItemRepository.findByCartAndProductId(cart, productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product " + productId + " is not in your cart"));

        validateStock(item.getProduct(), request.getQuantity());
        item.setQuantity(request.getQuantity());
        cartItemRepository.save(item);

        return CartResponse.from(cartRepository.findByUserWithItems(user).orElseThrow());
    }

    // ── Remove item ───────────────────────────────────────────────────

    @Transactional
    public CartResponse removeItem(User user, Long productId) {
        Cart cart = getCartOrThrow(user);
        return removeItemInternal(cart, user, productId);
    }

    // ── Clear cart ────────────────────────────────────────────────────

    @Transactional
    public CartResponse clearCart(User user) {
        cartRepository.findByUser(user).ifPresent(cart -> {
            cart.getItems().clear();      // orphanRemoval cascades deletes to DB
            cartRepository.save(cart);
        });
        return CartResponse.builder()
                .items(java.util.List.of())
                .totalItems(0)
                .totalAmount(java.math.BigDecimal.ZERO)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────

    /**
     * Returns existing cart or creates and persists a new empty one.
     * Called inside a write transaction.
     */
    public Cart getOrCreateCart(User user) {
        return cartRepository.findByUser(user)
                .orElseGet(() -> cartRepository.save(
                        Cart.builder().user(user).build()));
    }

    private Cart getCartOrThrow(User user) {
        return cartRepository.findByUser(user)
                .orElseThrow(() -> new BadRequestException("Your cart is empty"));
    }

    private CartResponse removeItemInternal(Cart cart, User user, Long productId) {
        cartItemRepository.findByCartAndProductId(cart, productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product " + productId + " is not in your cart"));
        cartItemRepository.deleteByCartAndProductId(cart, productId);
        // Re-fetch to get updated items list
        return CartResponse.from(
                cartRepository.findByUserWithItems(user)
                              .orElse(Cart.builder().user(user).build())
        );
    }

    private void validateStock(Product product, int requestedQuantity) {
        if (product.getStock() < requestedQuantity) {
            throw new InsufficientStockException(
                    product.getName(), requestedQuantity, product.getStock());
        }
    }
}
