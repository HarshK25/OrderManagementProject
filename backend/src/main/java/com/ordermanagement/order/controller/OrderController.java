package com.ordermanagement.order.controller;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.order.dto.OrderResponse;
import com.ordermanagement.order.dto.PlaceOrderRequest;
import com.ordermanagement.order.dto.UpdateOrderStatusRequest;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.service.OrderService;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Order endpoints.
 *
 * Customer (authenticated):
 *   POST   /api/orders               — place order from cart
 *   GET    /api/orders/me            — paginated list of own orders
 *   GET    /api/orders/{id}          — single order detail (own only)
 *   PATCH  /api/orders/{id}/cancel   — cancel (PENDING_PAYMENT or PAID)
 *
 * Admin:
 *   GET    /api/admin/orders         — all orders (filter by status)
 *   GET    /api/admin/orders/{id}    — any order detail
 *   PATCH  /api/admin/orders/{id}/status — drive state machine
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Orders", description = "Order lifecycle management")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;

    // ── Customer ──────────────────────────────────────────────────────

    @PostMapping("/api/orders")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Place an order from the cart")
    public OrderResponse placeOrder(@AuthenticationPrincipal User user,
                                    @Valid @RequestBody PlaceOrderRequest request) {
        return orderService.placeOrder(user, request);
    }

    @GetMapping("/api/orders/me")
    @Operation(summary = "List my orders (paginated)")
    public PagedResponse<OrderResponse> myOrders(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size,
                Sort.by("createdAt").descending());
        return orderService.getMyOrders(user, pageable);
    }

    @GetMapping("/api/orders/{id}")
    @Operation(summary = "Get a single order detail (own orders only)")
    public OrderResponse myOrderById(@AuthenticationPrincipal User user,
                                     @PathVariable Long id) {
        return orderService.getMyOrderById(user, id);
    }

    @PatchMapping("/api/orders/{id}/cancel")
    @Operation(summary = "Cancel an order (PENDING_PAYMENT or PAID only)")
    public OrderResponse cancelOrder(@AuthenticationPrincipal User user,
                                     @PathVariable Long id) {
        return orderService.cancelOrder(user, id);
    }

    // ── Admin ─────────────────────────────────────────────────────────

    @GetMapping("/api/admin/orders")
    @Operation(summary = "List all orders with optional status filter (admin)")
    public PagedResponse<OrderResponse> allOrders(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size,
                Sort.by("createdAt").descending());
        return orderService.getAllOrders(status, pageable);
    }

    @GetMapping("/api/admin/orders/{id}")
    @Operation(summary = "Get any order detail (admin)")
    public OrderResponse orderDetail(@PathVariable Long id) {
        return orderService.getOrderById(id);
    }

    @PatchMapping("/api/admin/orders/{id}/status")
    @Operation(summary = "Drive the order state machine (admin): PAID→SHIPPED, SHIPPED→DELIVERED, etc.")
    public OrderResponse updateStatus(@PathVariable Long id,
                                      @Valid @RequestBody UpdateOrderStatusRequest request,
                                      @AuthenticationPrincipal User admin) {
        return orderService.updateOrderStatus(id, request, admin.getEmail());
    }

    @DeleteMapping("/api/admin/orders/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Permanently delete an order and restore stock if needed (admin)")
    public void deleteOrder(@PathVariable Long id) {
        orderService.deleteOrder(id);
    }
}
