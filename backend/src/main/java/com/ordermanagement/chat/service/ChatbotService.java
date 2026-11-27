package com.ordermanagement.chat.service;

import com.ordermanagement.cart.dto.AddToCartRequest;
import com.ordermanagement.cart.dto.CartResponse;
import com.ordermanagement.cart.service.CartService;
import com.ordermanagement.chat.dto.ChatRequest;
import com.ordermanagement.chat.dto.ChatResponse;
import com.ordermanagement.coupon.entity.Coupon;
import com.ordermanagement.coupon.repository.CouponRepository;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.product.repository.ProductSpec;
import com.ordermanagement.user.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Actionable AI customer support chatbot (#4).
 *
 * Grounded in live PostgreSQL data when the user is signed in:
 *  - Tracks real orders (order number, status, total, tracking, ETA)
 *  - Reads active store coupons
 *  - Inspects cart contents
 *  - Executes "add <product> to cart" directly on the user's cart
 */
@Service
@Slf4j
public class ChatbotService {

    private static final String GROQ_BASE_URL  = "https://api.groq.com";
    private static final String GROQ_MODEL     = "openai/gpt-oss-20b";
    private static final int    MAX_HISTORY    = 20;
    private static final int    MAX_TOKENS     = 420;

    private static final String BASE_SYSTEM_PROMPT = """
            You are a friendly, actionable shopping assistant for ShopVerse (an Indian e-commerce store).
            
            Store details:
            - Payment methods: Razorpay (UPI, cards, net banking, wallets) and Cash on Delivery (COD)
            - Shipping: Same-day dispatch, 3-5 business days delivery
            - Return policy: 7-day easy returns for unused items in original packaging
            - Support: support@ordermanagement.com | +91 98765 43210 (Mon–Sat, 9 AM – 7 PM IST)
            
            Rules:
            - Be concise (1-4 short sentences or crisp bullets) and use INR (₹).
            - When LIVE ACCOUNT CONTEXT is provided below, answer directly using those real order numbers, statuses, cart totals, and coupon codes. Never invent order numbers or prices.
            - If a user is not signed in and asks to track their order or add to cart, politely ask them to sign in first.
            - Respond in English.
            """;

    private final WebClient webClient;
    private final OrderRepository orderRepository;
    private final CartService cartService;
    private final ProductRepository productRepository;
    private final CouponRepository couponRepository;

    @Value("${GROQ_API_KEY:}")
    private String groqApiKey;

    private final Map<String, List<Map<String, String>>> sessions = new ConcurrentHashMap<>();

    public ChatbotService(
            OrderRepository orderRepository,
            CartService cartService,
            ProductRepository productRepository,
            CouponRepository couponRepository) {
        this.orderRepository = orderRepository;
        this.cartService = cartService;
        this.productRepository = productRepository;
        this.couponRepository = couponRepository;
        this.webClient = WebClient.builder().baseUrl(GROQ_BASE_URL).build();
    }

    public ChatResponse chat(ChatRequest request, User currentUser) {
        String sessionId = (request.sessionId() != null && !request.sessionId().isBlank())
                ? request.sessionId()
                : UUID.randomUUID().toString();

        String userMsg = request.message().trim();
        List<Map<String, String>> history = sessions.computeIfAbsent(sessionId, k -> new ArrayList<>());
        history.add(Map.of("role", "user", "content", userMsg));

        // 1. Check for direct actionable tool intent ("add <product> to cart")
        String toolActionResult = tryExecuteAddToCart(userMsg, currentUser);

        // 2. Build live grounded context (orders, cart, coupons)
        String liveContext = buildLiveContext(currentUser, toolActionResult);

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", BASE_SYSTEM_PROMPT + "\n" + liveContext));
        messages.addAll(history);

        String reply = callGroq(messages, toolActionResult);
        history.add(Map.of("role", "assistant", "content", reply));

        if (history.size() > MAX_HISTORY) {
            history.subList(0, history.size() - MAX_HISTORY).clear();
        }

        return new ChatResponse(sessionId, reply);
    }

    private String tryExecuteAddToCart(String userMsg, User currentUser) {
        Matcher m = Pattern.compile("(?i)\\badd\\s+(.+?)\\s+(?:to\\s+)?(?:my\\s+)?cart\\b").matcher(userMsg);
        if (!m.find()) return null;

        if (currentUser == null) {
            return "ACTION_RESULT: User asked to add an item to cart, but is NOT signed in. Ask them to sign in at /login first.";
        }

        String itemQuery = m.group(1).replaceAll("(?i)\\b(a|an|the|some|1|one)\\b", "").trim();
        if (itemQuery.isEmpty()) return null;

        List<Product> matches = productRepository.findAll(
                ProductSpec.withFilters(null, null, null, itemQuery, true),
                PageRequest.of(0, 3)
        ).getContent();

        Product target = matches.stream().filter(p -> p.getStock() > 0).findFirst().orElse(null);
        if (target == null) {
            return "ACTION_RESULT: No in-stock product matched \"" + itemQuery + "\". Tell the user politely.";
        }

        try {
            AddToCartRequest req = new AddToCartRequest();
            req.setProductId(target.getId());
            req.setQuantity(1);
            CartResponse updated = cartService.addItem(currentUser, req);
            return "ACTION_EXECUTED: Successfully added 1 × \"" + target.getName() + "\" (₹" + target.getEffectivePrice() +
                    ") to " + currentUser.getName() + "'s cart! New cart total: ₹" + updated.getTotalAmount() +
                    " (" + updated.getTotalItems() + " items). Confirm this clearly and mention they can visit /cart or /checkout.";
        } catch (Exception ex) {
            return "ACTION_FAILED: Could not add \"" + target.getName() + "\" to cart: " + ex.getMessage();
        }
    }

    private String buildLiveContext(User currentUser, String toolActionResult) {
        StringBuilder sb = new StringBuilder("\n=== LIVE STORE & ACCOUNT CONTEXT ===\n");

        // Active coupons
        try {
            List<Coupon> activeCoupons = couponRepository.findAll().stream()
                    .filter(c -> c.isActive() && (c.getExpiresAt() == null || c.getExpiresAt().isAfter(LocalDateTime.now())))
                    .limit(5)
                    .toList();
            if (!activeCoupons.isEmpty()) {
                String couponStr = activeCoupons.stream()
                        .map(c -> c.getCode() + " (" + c.getDiscountType() + " " + c.getDiscountValue() +
                                (c.getMinOrderAmount() != null ? ", min ₹" + c.getMinOrderAmount() : "") + ")")
                        .collect(Collectors.joining("; "));
                sb.append("Active Coupons: ").append(couponStr).append("\n");
            }
        } catch (Exception ignored) {}

        if (currentUser != null) {
            sb.append("Signed-in Customer: ").append(currentUser.getName())
                    .append(" (").append(currentUser.getEmail()).append(")\n");

            // Recent orders
            try {
                List<Order> orders = orderRepository.findByUser(
                        currentUser, PageRequest.of(0, 5, Sort.by("createdAt").descending())
                ).getContent();
                if (orders.isEmpty()) {
                    sb.append("Recent Orders: None placed yet.\n");
                } else {
                    sb.append("Recent Orders:\n");
                    for (Order o : orders) {
                        sb.append("  - ").append(o.getOrderNumber())
                                .append(" | Status: ").append(o.getStatus())
                                .append(" | Total: ₹").append(o.getTotal());
                        if (o.getTrackingNumber() != null) sb.append(" | Tracking: ").append(o.getTrackingNumber());
                        if (o.getEstimatedDeliveryDate() != null) sb.append(" | ETA: ").append(o.getEstimatedDeliveryDate());
                        sb.append("\n");
                    }
                }
            } catch (Exception ex) {
                log.debug("Chatbot order lookup skipped: {}", ex.getMessage());
            }

            // Current cart
            try {
                CartResponse cart = cartService.getCart(currentUser);
                if (cart.getItems() == null || cart.getItems().isEmpty()) {
                    sb.append("Current Cart: Empty\n");
                } else {
                    String items = cart.getItems().stream()
                            .map(i -> i.getProductName() + " ×" + i.getQuantity())
                            .collect(Collectors.joining(", "));
                    sb.append("Current Cart: ").append(cart.getTotalItems())
                            .append(" item(s), Total ₹").append(cart.getTotalAmount())
                            .append(" [").append(items).append("]\n");
                }
            } catch (Exception ex) {
                log.debug("Chatbot cart lookup skipped: {}", ex.getMessage());
            }
        } else {
            sb.append("Customer Status: Guest (not signed in)\n");
        }

        if (toolActionResult != null) {
            sb.append(toolActionResult).append("\n");
        }
        return sb.toString();
    }

    private String callGroq(List<Map<String, String>> messages, String toolActionResult) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            return toolActionResult != null
                    ? toolActionResult.replaceFirst("^ACTION_[A-Z]+:\\s*", "")
                    : "AI chat is currently running in offline mode. Please check My Orders or contact support@ordermanagement.com.";
        }

        Map<String, Object> body = Map.of(
                "model",       GROQ_MODEL,
                "max_tokens",  MAX_TOKENS,
                "temperature", 0.55,
                "messages",    messages
        );

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.post()
                    .uri("/openai/v1/chat/completions")
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + groqApiKey)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            return ((String) message.get("content")).trim();

        } catch (WebClientResponseException ex) {
            log.error("Groq chatbot error {}: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            return toolActionResult != null
                    ? toolActionResult.replaceFirst("^ACTION_[A-Z]+:\\s*", "")
                    : "Sorry, I'm having trouble connecting right now. Please try again in a moment.";
        } catch (Exception ex) {
            log.error("Chatbot unexpected error: {}", ex.getMessage(), ex);
            return toolActionResult != null
                    ? toolActionResult.replaceFirst("^ACTION_[A-Z]+:\\s*", "")
                    : "Sorry, something went wrong. Please try again or contact support@ordermanagement.com.";
        }
    }
}
