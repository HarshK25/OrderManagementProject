package com.ordermanagement.order;

import com.ordermanagement.cart.entity.Cart;
import com.ordermanagement.cart.entity.CartItem;
import com.ordermanagement.cart.service.CartService;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.InvalidStateTransitionException;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.notification.service.OrderEventMessage;
import com.ordermanagement.order.dto.OrderResponse;
import com.ordermanagement.order.dto.PlaceOrderRequest;
import com.ordermanagement.order.dto.UpdateOrderStatusRequest;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderItem;
import com.ordermanagement.order.entity.OrderStatus;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.order.service.OrderPlacedEvent;
import com.ordermanagement.order.service.OrderService;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Mockito unit tests for OrderService.
 *
 * Tests:
 *  1. placeOrder — happy path: stock decremented, order saved, events published
 *  2. placeOrder — empty cart: BadRequestException
 *  3. placeOrder — stock exhausted: InsufficientStockException
 *  4. cancelOrder — legal from PENDING_PAYMENT
 *  5. updateOrderStatus — legal PAID → SHIPPED
 *  6. updateOrderStatus — illegal transition: InvalidStateTransitionException
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock ProductRepository productRepository;
    @Mock CartService cartService;
    @Mock AppProperties appProperties;
    @Mock ApplicationEventPublisher eventPublisher;

    @InjectMocks OrderService orderService;

    private User user;
    private Product product;
    private Cart cart;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .email("customer@test.com")
                .name("Test Customer")
                .build();

        product = Product.builder()
                .id(10L)
                .name("Test Product")
                .price(new BigDecimal("500.00"))
                .discountPercent(new BigDecimal("10"))
                .stock(20)
                .build();

        CartItem cartItem = CartItem.builder()
                .id(1L)
                .product(product)
                .quantity(2)
                .build();

        cart = Cart.builder()
                .id(1L)
                .user(user)
                .items(new ArrayList<>(List.of(cartItem)))
                .build();

        // Default AppProperties setup
        AppProperties.Payment payment = new AppProperties.Payment();
        payment.setWindowMinutes(15);
        when(appProperties.getPayment()).thenReturn(payment);
    }

    // ── 1. placeOrder — happy path ────────────────────────────────────

    @Test
    void placeOrder_happyPath_stockDecrementedAndEventPublished() {
        PlaceOrderRequest request = buildPlaceOrderRequest();

        when(cartService.getOrCreateCart(user)).thenReturn(cart);
        when(productRepository.decrementStockIfAvailable(10L, 2)).thenReturn(1);
        when(orderRepository.countByOrderNumberStartingWith(anyString())).thenReturn(0L);

        Order savedOrder = Order.builder()
                .id(99L)
                .orderNumber("ORD-20241015-0001")
                .user(user)
                .status(OrderStatus.PENDING_PAYMENT)
                .subtotal(new BigDecimal("1000.00"))
                .discountTotal(new BigDecimal("100.00"))
                .total(new BigDecimal("900.00"))
                .items(new ArrayList<>())
                .statusHistory(new ArrayList<>())
                .build();
        when(orderRepository.save(any(Order.class))).thenReturn(savedOrder);

        OrderResponse response = orderService.placeOrder(user, request);

        // Stock must have been decremented
        verify(productRepository).decrementStockIfAvailable(10L, 2);
        // Cart must have been cleared
        verify(cartService).clearCart(user);
        // Both domain events must be published
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher, times(2)).publishEvent(eventCaptor.capture());
        List<Object> events = eventCaptor.getAllValues();
        assertThat(events).anyMatch(e -> e instanceof OrderPlacedEvent);
        assertThat(events).anyMatch(e -> e instanceof OrderEventMessage msg
                && "order.placed".equals(msg.routingKey()));
    }

    // ── 2. placeOrder — empty cart ────────────────────────────────────

    @Test
    void placeOrder_emptyCart_throwsBadRequest() {
        cart.getItems().clear();
        when(cartService.getOrCreateCart(user)).thenReturn(cart);

        assertThatThrownBy(() -> orderService.placeOrder(user, buildPlaceOrderRequest()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cart is empty");

        verifyNoInteractions(orderRepository, productRepository);
    }

    // ── 3. placeOrder — insufficient stock ───────────────────────────

    @Test
    void placeOrder_insufficientStock_throwsException() {
        when(cartService.getOrCreateCart(user)).thenReturn(cart);
        when(productRepository.decrementStockIfAvailable(10L, 2)).thenReturn(0);
        // fresh product with 0 stock
        when(productRepository.findById(10L)).thenReturn(Optional.of(
                Product.builder().id(10L).name("Test Product").stock(0).build()
        ));

        assertThatThrownBy(() -> orderService.placeOrder(user, buildPlaceOrderRequest()))
                .hasMessageContaining("Test Product");

        verify(orderRepository, never()).save(any());
    }

    // ── 4. cancelOrder — legal from PENDING_PAYMENT ──────────────────

    @Test
    void cancelOrder_fromPendingPayment_succeeds() {
        Order order = buildOrderWithStatus(99L, OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findByIdAndUserWithDetails(99L, user)).thenReturn(Optional.of(order));
        when(orderRepository.save(any())).thenReturn(order);

        OrderResponse response = orderService.cancelOrder(user, 99L);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        verify(productRepository, times(order.getItems().size())).incrementStock(anyLong(), anyInt());
    }

    // ── 5. updateOrderStatus — PAID → SHIPPED ────────────────────────

    @Test
    void updateOrderStatus_paidToShipped_succeeds() {
        Order order = buildOrderWithStatus(99L, OrderStatus.PAID);
        when(orderRepository.findByIdWithDetails(99L)).thenReturn(Optional.of(order));
        when(orderRepository.save(any())).thenReturn(order);

        UpdateOrderStatusRequest req = new UpdateOrderStatusRequest();
        req.setStatus(OrderStatus.SHIPPED);
        req.setNote("Shipped by warehouse");

        orderService.updateOrderStatus(99L, req, "admin@test.com");

        assertThat(order.getStatus()).isEqualTo(OrderStatus.SHIPPED);
    }

    // ── 6. illegal transition ─────────────────────────────────────────

    @Test
    void updateOrderStatus_illegalTransition_throwsConflict() {
        Order order = buildOrderWithStatus(99L, OrderStatus.DELIVERED);
        when(orderRepository.findByIdWithDetails(99L)).thenReturn(Optional.of(order));

        UpdateOrderStatusRequest req = new UpdateOrderStatusRequest();
        req.setStatus(OrderStatus.PENDING_PAYMENT);
        req.setNote("Bad transition");

        assertThatThrownBy(() -> orderService.updateOrderStatus(99L, req, "admin@test.com"))
                .isInstanceOf(InvalidStateTransitionException.class);
    }

    // ── helpers ───────────────────────────────────────────────────────

    private PlaceOrderRequest buildPlaceOrderRequest() {
        PlaceOrderRequest r = new PlaceOrderRequest();
        r.setShippingName("Test Customer");
        r.setShippingPhone("9999999999");
        r.setShippingAddress("123 Test St");
        r.setShippingCity("Mumbai");
        r.setShippingState("Maharashtra");
        r.setShippingPincode("400001");
        return r;
    }

    private Order buildOrderWithStatus(Long id, OrderStatus status) {
        OrderItem item = OrderItem.builder()
                .id(1L)
                .product(product)
                .productName("Test Product")
                .quantity(2)
                .unitPrice(new BigDecimal("450.00"))
                .lineTotal(new BigDecimal("900.00"))
                .build();

        Order order = Order.builder()
                .id(id)
                .orderNumber("ORD-20241015-0001")
                .user(user)
                .status(status)
                .subtotal(new BigDecimal("1000.00"))
                .discountTotal(new BigDecimal("100.00"))
                .total(new BigDecimal("900.00"))
                .items(new ArrayList<>(List.of(item)))
                .statusHistory(new ArrayList<>())
                .build();
        item.setOrder(order);
        return order;
    }
}
