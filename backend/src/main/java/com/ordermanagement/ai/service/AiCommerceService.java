package com.ordermanagement.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordermanagement.config.AppProperties;
import com.ordermanagement.notification.entity.InAppNotification;
import com.ordermanagement.notification.repository.InAppNotificationRepository;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.repository.OrderRepository;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.product.repository.ProductSpec;
import com.ordermanagement.product.service.ProductService;
import com.ordermanagement.product.service.SearchRecommendationService;
import jakarta.mail.internet.MimeMessage;
import jakarta.persistence.EntityManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Unified AI commerce intelligence service covering:
 *  #2 Natural-Language / Intent Shopping Search
 *  #3 AI Product Comparison ("Compare with AI")
 *  #5 Frequently Bought Together (SQL co-occurrence + smart fallback)
 *  #7 Admin AI Return-Reason Analyzer & Risk Flagging
 *  #9 Admin AI Customer Notification / Email Drafter & Sender
 *
 * All LLM features use Groq (openai/gpt-oss-20b) with deterministic fallbacks
 * so endpoints always remain fast and reliable.
 */
@Service
@Slf4j
public class AiCommerceService {

    private static final String GROQ_MODEL = "openai/gpt-oss-20b";

    private final ProductRepository productRepository;
    private final ProductService productService;
    private final OrderRepository orderRepository;
    private final InAppNotificationRepository notificationRepository;
    private final SearchRecommendationService searchRecommendationService;
    private final EntityManager em;
    private final AppProperties props;
    private final ObjectMapper objectMapper;
    private final JavaMailSender mailSender;
    private final WebClient webClient;

    public AiCommerceService(
            ProductRepository productRepository,
            ProductService productService,
            OrderRepository orderRepository,
            InAppNotificationRepository notificationRepository,
            SearchRecommendationService searchRecommendationService,
            EntityManager em,
            AppProperties props,
            ObjectMapper objectMapper,
            JavaMailSender mailSender) {
        this.productRepository = productRepository;
        this.productService = productService;
        this.orderRepository = orderRepository;
        this.notificationRepository = notificationRepository;
        this.searchRecommendationService = searchRecommendationService;
        this.em = em;
        this.props = props;
        this.objectMapper = objectMapper;
        this.mailSender = mailSender;
        this.webClient = WebClient.builder().baseUrl("https://api.groq.com").build();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // #2 Natural-Language / Intent Shopping Search
    // ═══════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public Map<String, Object> smartSearch(String rawQuery) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.isEmpty()) {
            return Map.of(
                    "originalQuery", "",
                    "keywords", "",
                    "sortBy", "createdAt",
                    "direction", "desc",
                    "explanation", "Showing latest catalog items",
                    "products", List.of()
            );
        }

        // Start with fast deterministic parsing
        ParsedIntent intent = parseIntentDeterministic(query);

        // Enrich with Groq LLM if configured
        String llmJson = callGroq(
                "You extract structured e-commerce search filters from a shopper's natural-language query. " +
                "Return ONLY valid JSON with keys: keywords (string, core product/category words without price/sort words), " +
                "minPrice (number or null, in INR), maxPrice (number or null, in INR), " +
                "sortBy ('price' or 'createdAt'), direction ('asc' or 'desc'), explanation (short 1-line summary).",
                "Shopper query: \"" + query + "\"",
                220, 0.1
        );

        if (llmJson != null) {
            try {
                String cleaned = extractJsonObject(llmJson);
                JsonNode node = objectMapper.readTree(cleaned);
                String kw = node.path("keywords").asText("").trim();
                BigDecimal minP = node.hasNonNull("minPrice") && node.get("minPrice").isNumber()
                        ? node.get("minPrice").decimalValue() : intent.minPrice;
                BigDecimal maxP = node.hasNonNull("maxPrice") && node.get("maxPrice").isNumber()
                        ? node.get("maxPrice").decimalValue() : intent.maxPrice;
                String sortBy = "price".equalsIgnoreCase(node.path("sortBy").asText("")) ? "price" : intent.sortBy;
                String dir = "asc".equalsIgnoreCase(node.path("direction").asText("")) ? "asc"
                        : ("desc".equalsIgnoreCase(node.path("direction").asText("")) ? "desc" : intent.direction);
                String exp = node.path("explanation").asText("").trim();
                intent = new ParsedIntent(
                        kw.isEmpty() ? intent.keywords : kw,
                        minP, maxP, sortBy, dir,
                        exp.isEmpty() ? intent.explanation : exp
                );
            } catch (Exception ex) {
                log.debug("Smart search LLM parse fallback: {}", ex.getMessage());
            }
        }

        if (intent.keywords != null && !intent.keywords.isBlank()) {
            searchRecommendationService.recordSearch(intent.keywords);
        }

        Sort sort = "asc".equalsIgnoreCase(intent.direction)
                ? Sort.by(intent.sortBy).ascending()
                : Sort.by(intent.sortBy).descending();
        Specification<Product> spec = ProductSpec.withFilters(
                null, intent.minPrice, intent.maxPrice,
                (intent.keywords == null || intent.keywords.isBlank()) ? null : intent.keywords,
                true
        );
        List<ProductResponse> products = productRepository.findAll(spec, PageRequest.of(0, 12, sort))
                .getContent().stream().map(ProductResponse::from).toList();

        String finalKeywords = intent.keywords != null ? intent.keywords : "";
        String finalExplanation = intent.explanation;
        if (products.isEmpty() && !finalKeywords.isBlank()) {
            String corrected = productService.correctSpelling(finalKeywords);
            if (corrected != null && !corrected.equalsIgnoreCase(finalKeywords)) {
                Specification<Product> correctedSpec = ProductSpec.withFilters(
                        null, intent.minPrice, intent.maxPrice, corrected, true);
                List<ProductResponse> correctedHits = productRepository.findAll(correctedSpec, PageRequest.of(0, 12, sort))
                        .getContent().stream().map(ProductResponse::from).toList();
                if (!correctedHits.isEmpty()) {
                    products = correctedHits;
                    finalKeywords = corrected;
                    finalExplanation = "Auto-corrected to \"" + corrected + "\" · " + intent.explanation;
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("originalQuery", query);
        result.put("keywords", finalKeywords);
        result.put("minPrice", intent.minPrice);
        result.put("maxPrice", intent.maxPrice);
        result.put("sortBy", intent.sortBy);
        result.put("direction", intent.direction);
        result.put("explanation", finalExplanation);
        result.put("products", products);
        return result;
    }

    private record ParsedIntent(String keywords, BigDecimal minPrice, BigDecimal maxPrice,
                                String sortBy, String direction, String explanation) {}

    private ParsedIntent parseIntentDeterministic(String q) {
        String lower = q.toLowerCase();
        BigDecimal minP = null;
        BigDecimal maxP = null;
        String sortBy = "createdAt";
        String dir = "desc";

        Matcher between = Pattern.compile("between\\s*₹?\\s*(\\d+)\\s*(?:and|to|-)\\s*₹?\\s*(\\d+)").matcher(lower);
        if (between.find()) {
            minP = new BigDecimal(between.group(1));
            maxP = new BigDecimal(between.group(2));
        } else {
            Matcher under = Pattern.compile("(?:under|below|less than|max|upto|up to|<=)\\s*₹?\\s*(\\d+)").matcher(lower);
            if (under.find()) maxP = new BigDecimal(under.group(1));
            Matcher above = Pattern.compile("(?:above|over|more than|min|from|>=)\\s*₹?\\s*(\\d+)").matcher(lower);
            if (above.find()) minP = new BigDecimal(above.group(1));
        }

        if (lower.contains("cheap") || lower.contains("budget") || lower.contains("lowest") || lower.contains("affordable")) {
            sortBy = "price";
            dir = "asc";
        } else if (lower.contains("premium") || lower.contains("expensive") || lower.contains("highest")) {
            sortBy = "price";
            dir = "desc";
        }

        // Strip price/sort filler phrases to keep clean product keywords
        String cleaned = lower
                .replaceAll("between\\s*₹?\\s*\\d+\\s*(?:and|to|-)\\s*₹?\\s*\\d+", " ")
                .replaceAll("(?:under|below|less than|max|upto|up to|above|over|more than|min|from|<=|>=)\\s*₹?\\s*\\d+", " ")
                .replaceAll("\\b(best|cheap|cheapest|budget|affordable|premium|expensive|lowest|highest|price|rs|inr|rupees|for|me|show|find|gift|lover|with|good|top)\\b", " ")
                .replaceAll("₹", " ")
                .replaceAll("\\s+", " ")
                .trim();

        StringBuilder exp = new StringBuilder("Searching");
        if (!cleaned.isEmpty()) exp.append(" for \"").append(cleaned).append("\"");
        if (minP != null) exp.append(" from ₹").append(minP.toPlainString());
        if (maxP != null) exp.append(" under ₹").append(maxP.toPlainString());
        if ("price".equals(sortBy)) exp.append(" · sorted by price (").append("asc".equals(dir) ? "low to high" : "high to low").append(")");

        return new ParsedIntent(cleaned, minP, maxP, sortBy, dir, exp.toString());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // #3 AI Product Comparison ("Compare with AI")
    // ═══════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public Map<String, Object> compareProducts(List<Long> ids) {
        List<Long> cleanIds = ids == null ? List.of() : ids.stream().distinct().limit(3).toList();
        if (cleanIds.size() < 2) {
            return Map.of("error", "Please select at least 2 products to compare.");
        }

        List<Product> products = new ArrayList<>();
        for (Long id : cleanIds) {
            productRepository.findByIdWithCategory(id).ifPresent(products::add);
        }
        if (products.size() < 2) {
            return Map.of("error", "Could not find at least 2 valid products to compare.");
        }

        // Fetch rating summaries
        Map<Long, double[]> ratingMap = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(
                "SELECT product_id, COALESCE(AVG(rating), 0), COUNT(*) FROM product_reviews WHERE product_id IN (:ids) GROUP BY product_id")
                .setParameter("ids", cleanIds)
                .getResultList();
        for (Object[] r : rows) {
            ratingMap.put(((Number) r[0]).longValue(), new double[]{
                    ((Number) r[1]).doubleValue(),
                    ((Number) r[2]).doubleValue()
            });
        }

        List<Map<String, Object>> productCards = new ArrayList<>();
        StringBuilder promptCtx = new StringBuilder("Products to compare:\n");
        for (Product p : products) {
            ProductResponse dto = ProductResponse.from(p);
            double[] r = ratingMap.getOrDefault(p.getId(), new double[]{0.0, 0.0});
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("id", dto.getId());
            card.put("name", dto.getName());
            card.put("category", dto.getCategory() != null ? dto.getCategory().getName() : "General");
            card.put("price", dto.getPrice());
            card.put("discountPercent", dto.getDiscountPercent());
            card.put("effectivePrice", dto.getEffectivePrice());
            card.put("stock", dto.getStock());
            card.put("imageUrl", dto.getImageUrl());
            card.put("description", dto.getDescription());
            card.put("avgRating", Math.round(r[0] * 10.0) / 10.0);
            card.put("reviewCount", (int) r[1]);
            productCards.add(card);

            promptCtx.append("- ").append(dto.getName())
                    .append(" (Category: ").append(card.get("category"))
                    .append(", Price: ₹").append(dto.getEffectivePrice())
                    .append(", MRP: ₹").append(dto.getPrice())
                    .append(", Discount: ").append(dto.getDiscountPercent()).append("%")
                    .append(", Rating: ").append(card.get("avgRating")).append("/5 from ").append(card.get("reviewCount")).append(" reviews")
                    .append(", Desc: ").append(dto.getDescription() != null ? dto.getDescription() : "N/A")
                    .append(")\n");
        }

        String aiSummary = callGroq(
                "You are a concise, objective e-commerce product advisor for Indian shoppers. " +
                "Compare the given products in 3-4 short bullet points (Value, Key Differences, Best Pick) using INR (₹). Keep it under 140 words.",
                promptCtx.toString(),
                320, 0.4
        );

        String source = "ai";
        if (aiSummary == null || aiSummary.isBlank()) {
            source = "fallback";
            ProductResponse cheapest = products.stream().map(ProductResponse::from)
                    .min(Comparator.comparing(ProductResponse::getEffectivePrice)).orElseThrow();
            ProductResponse bestDiscount = products.stream().map(ProductResponse::from)
                    .max(Comparator.comparing(ProductResponse::getDiscountPercent)).orElseThrow();
            aiSummary = "• Best Value: " + cheapest.getName() + " at ₹" + cheapest.getEffectivePrice() + "\n"
                    + "• Biggest Discount: " + bestDiscount.getName() + " (" + bestDiscount.getDiscountPercent() + "% off)\n"
                    + "• Compare full specs, ratings, and stock availability side by side below.";
        }

        return Map.of(
                "products", productCards,
                "verdict", aiSummary,
                "source", source
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // #5 Frequently Bought Together
    // ═══════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public Map<String, Object> frequentlyBoughtTogether(Long productId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 4));
        Product anchor = productRepository.findByIdWithCategory(productId).orElse(null);
        if (anchor == null) {
            return Map.of("products", List.of(), "source", "none");
        }

        Map<Long, ProductResponse> picks = new LinkedHashMap<>();
        String source = "co_occurrence";

        try {
            @SuppressWarnings("unchecked")
            List<Object[]> coRows = em.createNativeQuery(
                    "SELECT oi2.product_id, COUNT(*) AS freq " +
                    "FROM order_items oi1 " +
                    "JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id <> oi2.product_id " +
                    "JOIN products p ON p.id = oi2.product_id " +
                    "WHERE oi1.product_id = :pid AND p.active = true AND p.stock > 0 " +
                    "GROUP BY oi2.product_id ORDER BY freq DESC LIMIT :lim")
                    .setParameter("pid", productId)
                    .setParameter("lim", safeLimit)
                    .getResultList();

            for (Object[] r : coRows) {
                Long pid = ((Number) r[0]).longValue();
                productRepository.findByIdWithCategory(pid)
                        .ifPresent(p -> picks.put(p.getId(), ProductResponse.from(p)));
            }
        } catch (Exception ex) {
            log.debug("Co-occurrence query fallback: {}", ex.getMessage());
        }

        // Pad with complementary in-stock items (preferring other categories for real cross-sell bundles)
        if (picks.size() < safeLimit) {
            if (picks.isEmpty()) source = "smart_bundle";
            List<Product> allActive = productRepository.findAll(
                    ProductSpec.withFilters(null, null, null, null, true),
                    PageRequest.of(0, 20, Sort.by("discountPercent").descending())
            ).getContent();
            Long anchorCatId = anchor.getCategory() != null ? anchor.getCategory().getId() : null;

            // First pass: different category (cross-sell)
            for (Product p : allActive) {
                if (picks.size() >= safeLimit) break;
                if (p.getId().equals(productId) || p.getStock() <= 0 || picks.containsKey(p.getId())) continue;
                Long pCatId = p.getCategory() != null ? p.getCategory().getId() : null;
                if (anchorCatId == null || !anchorCatId.equals(pCatId)) {
                    picks.put(p.getId(), ProductResponse.from(p));
                }
            }
            // Second pass: any remaining active product
            for (Product p : allActive) {
                if (picks.size() >= safeLimit) break;
                if (p.getId().equals(productId) || p.getStock() <= 0 || picks.containsKey(p.getId())) continue;
                picks.put(p.getId(), ProductResponse.from(p));
            }
        }

        List<ProductResponse> bundleList = new ArrayList<>(picks.values());
        BigDecimal bundleTotal = ProductResponse.from(anchor).getEffectivePrice();
        for (ProductResponse pr : bundleList) {
            bundleTotal = bundleTotal.add(pr.getEffectivePrice());
        }

        return Map.of(
                "anchorProductId", productId,
                "products", bundleList,
                "bundleTotal", bundleTotal.setScale(2, RoundingMode.HALF_UP),
                "source", source
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // #7 Admin AI Return-Reason Analyzer & Risk / Abuse Flagging
    // ═══════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public Map<String, Object> analyzeReturnsAndRisk() {
        @SuppressWarnings("unchecked")
        List<Object[]> returnRows = em.createNativeQuery(
                "SELECT r.id, r.reason, o.status, r.refund_amount, o.order_number, u.name, u.email " +
                "FROM return_requests r " +
                "JOIN orders o ON o.id = r.order_id " +
                "JOIN users u ON u.id = o.user_id " +
                "ORDER BY r.created_at DESC")
                .getResultList();

        Map<String, Integer> clusters = new LinkedHashMap<>();
        clusters.put("Defective / Damaged", 0);
        clusters.put("Wrong Item / Size", 0);
        clusters.put("Quality / Not as Described", 0);
        clusters.put("Changed Mind / Other", 0);

        BigDecimal totalRefunded = BigDecimal.ZERO;
        List<String> sampleReasons = new ArrayList<>();

        for (Object[] r : returnRows) {
            String reason = r[1] != null ? r[1].toString() : "";
            String lower = reason.toLowerCase();
            if (lower.contains("defect") || lower.contains("damag") || lower.contains("broken") || lower.contains("not working") || lower.contains("fault")) {
                clusters.merge("Defective / Damaged", 1, Integer::sum);
            } else if (lower.contains("wrong") || lower.contains("size") || lower.contains("fit") || lower.contains("color") || lower.contains("colour")) {
                clusters.merge("Wrong Item / Size", 1, Integer::sum);
            } else if (lower.contains("quality") || lower.contains("fake") || lower.contains("poor") || lower.contains("descript") || lower.contains("expect")) {
                clusters.merge("Quality / Not as Described", 1, Integer::sum);
            } else {
                clusters.merge("Changed Mind / Other", 1, Integer::sum);
            }
            if (r[3] != null) totalRefunded = totalRefunded.add(new BigDecimal(r[3].toString()));
            if (sampleReasons.size() < 10 && !reason.isBlank()) sampleReasons.add(reason);
        }

        // Detect risk / abuse patterns per customer (high return or cancellation ratios)
        @SuppressWarnings("unchecked")
        List<Object[]> riskRows = em.createNativeQuery(
                "SELECT u.id, u.name, u.email, " +
                "  COUNT(DISTINCT o.id) AS total_orders, " +
                "  COUNT(DISTINCT CASE WHEN o.status = 'CANCELLED' THEN o.id END) AS cancelled_orders, " +
                "  COUNT(DISTINCT rr.id) AS total_returns " +
                "FROM users u " +
                "LEFT JOIN orders o ON o.user_id = u.id " +
                "LEFT JOIN return_requests rr ON rr.order_id = o.id " +
                "GROUP BY u.id, u.name, u.email " +
                "HAVING COUNT(DISTINCT rr.id) >= 2 OR COUNT(DISTINCT CASE WHEN o.status = 'CANCELLED' THEN o.id END) >= 2 " +
                "ORDER BY COUNT(DISTINCT rr.id) DESC, COUNT(DISTINCT CASE WHEN o.status = 'CANCELLED' THEN o.id END) DESC " +
                "LIMIT 10")
                .getResultList();

        List<Map<String, Object>> flaggedAccounts = new ArrayList<>();
        for (Object[] row : riskRows) {
            long totalOrders = ((Number) row[3]).longValue();
            long cancelled = ((Number) row[4]).longValue();
            long returns = ((Number) row[5]).longValue();
            String riskLevel = (returns >= 3 || cancelled >= 4) ? "HIGH" : "MEDIUM";
            String flagReason = returns >= 2 && cancelled >= 2
                    ? returns + " returns & " + cancelled + " cancellations across " + totalOrders + " orders"
                    : (returns >= 2
                        ? returns + " return requests across " + totalOrders + " orders"
                        : cancelled + " cancelled orders across " + totalOrders + " orders");

            flaggedAccounts.add(Map.of(
                    "userId", ((Number) row[0]).longValue(),
                    "name", row[1] != null ? row[1].toString() : "Customer",
                    "email", row[2] != null ? row[2].toString() : "",
                    "totalOrders", totalOrders,
                    "cancelledOrders", cancelled,
                    "totalReturns", returns,
                    "riskLevel", riskLevel,
                    "flagReason", flagReason
            ));
        }

        String summaryPrompt = "Total returns: " + returnRows.size() +
                ", Total refunded: ₹" + totalRefunded.setScale(2, RoundingMode.HALF_UP) +
                ", Clusters: " + clusters +
                ", Flagged accounts: " + flaggedAccounts.size() +
                ", Sample return reasons: " + sampleReasons;

        String aiSummary = callGroq(
                "You are an e-commerce fraud & operations analyst. Give 3 concise bullet points: top root cause, risk assessment, and 1 recommended action.",
                summaryPrompt,
                250, 0.3
        );
        if (aiSummary == null || aiSummary.isBlank()) {
            String topCluster = clusters.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey).orElse("None");
            aiSummary = returnRows.isEmpty()
                    ? "• No return requests recorded yet — return health is 100% clean.\n• Automated risk monitoring is active for repeat cancellations and return spikes."
                    : "• Top Return Driver: " + topCluster + " across " + returnRows.size() + " return(s) (₹" + totalRefunded.setScale(2, RoundingMode.HALF_UP) + " refunded).\n"
                      + "• Risk Monitoring: " + flaggedAccounts.size() + " account(s) flagged for review.\n"
                      + "• Recommendation: Audit packaging/listing accuracy for the top cluster and review flagged accounts before auto-approving refunds.";
        }

        return Map.of(
                "totalReturns", returnRows.size(),
                "totalRefunded", totalRefunded.setScale(2, RoundingMode.HALF_UP),
                "clusters", clusters,
                "flaggedAccounts", flaggedAccounts,
                "aiSummary", aiSummary
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // #9 Admin AI Customer Notification / Email Drafter & Sender
    // ═══════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public Map<String, Object> draftCustomerNotification(Long orderId, String scenario) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        String customerName = order.getUser() != null ? order.getUser().getName() : "Customer";
        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : "";
        String safeScenario = (scenario == null || scenario.isBlank()) ? "ORDER_UPDATE" : scenario.trim().toUpperCase();

        String prompt = """
                Draft a warm, concise customer notification for an Indian e-commerce store (ShopVerse).
                Customer: %s
                Order Number: %s
                Current Status: %s
                Order Total: ₹%s
                Scenario: %s (DELAY_APOLOGY = shipping delay apology, DELIVERY_FOLLOWUP = post-delivery check-in & review invite, ORDER_UPDATE = proactive status update, VIP_THANK_YOU = thank-you with WELCOME10 coupon)
                Return ONLY valid JSON with keys: "title" (max 70 chars), "message" (2-3 polite sentences, max 400 chars).
                """.formatted(customerName, order.getOrderNumber(), order.getStatus(), order.getTotal(), safeScenario);

        String title = "Update on your order " + order.getOrderNumber();
        String message = "Hi " + customerName + ", thank you for shopping with ShopVerse! Your order " +
                order.getOrderNumber() + " is currently " + order.getStatus().name().replace('_', ' ').toLowerCase() +
                ". Please reach out anytime if you need assistance.";
        String source = "fallback";

        String llmJson = callGroq(
                "You write polite, clear customer service notifications. Return ONLY valid JSON with keys title and message.",
                prompt, 240, 0.5
        );
        if (llmJson != null) {
            try {
                JsonNode node = objectMapper.readTree(extractJsonObject(llmJson));
                String t = node.path("title").asText("").trim();
                String m = node.path("message").asText("").trim();
                if (!t.isEmpty() && !m.isEmpty()) {
                    title = t;
                    message = m;
                    source = "ai";
                }
            } catch (Exception ex) {
                log.debug("Notification draft parse fallback: {}", ex.getMessage());
            }
        } else {
            switch (safeScenario) {
                case "DELAY_APOLOGY" -> {
                    title = "Apologies for the slight delay on " + order.getOrderNumber();
                    message = "Hi " + customerName + ", we sincerely apologize for the delay in dispatching your order " +
                            order.getOrderNumber() + ". Our fulfillment team has prioritized your shipment and will share updated tracking shortly. Thank you for your patience!";
                }
                case "DELIVERY_FOLLOWUP" -> {
                    title = "Hope you're enjoying order " + order.getOrderNumber() + "!";
                    message = "Hi " + customerName + ", we hope your order " + order.getOrderNumber() +
                            " arrived in great condition. We'd love to hear your feedback — leave a quick review on the product page anytime!";
                }
                case "VIP_THANK_YOU" -> {
                    title = "Thank you for your order, " + customerName + "!";
                    message = "Hi " + customerName + ", thank you for shopping with ShopVerse! As a token of appreciation for order " +
                            order.getOrderNumber() + ", enjoy 10% off your next purchase with code WELCOME10.";
                }
                default -> {}
            }
        }

        return Map.of(
                "orderId", order.getId(),
                "orderNumber", order.getOrderNumber(),
                "customerName", customerName,
                "customerEmail", customerEmail,
                "scenario", safeScenario,
                "title", title,
                "message", message,
                "source", source
        );
    }

    @Transactional
    public Map<String, Object> sendCustomerNotification(Long orderId, String title, String message, boolean sendEmail) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        if (order.getUser() == null) {
            throw new IllegalArgumentException("Order has no associated user");
        }

        String safeTitle = (title == null || title.isBlank()) ? "Update on order " + order.getOrderNumber() : title.trim();
        String safeMessage = (message == null || message.isBlank()) ? "Your order has been updated." : message.trim();

        InAppNotification saved = notificationRepository.save(InAppNotification.builder()
                .user(order.getUser())
                .title(safeTitle.substring(0, Math.min(200, safeTitle.length())))
                .message(safeMessage.substring(0, Math.min(1000, safeMessage.length())))
                .type("ORDER")
                .link("/orders/" + order.getId())
                .build());

        boolean emailSent = false;
        if (sendEmail && order.getUser().getEmail() != null && !order.getUser().getEmail().isBlank()) {
            try {
                MimeMessage mime = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mime, "UTF-8");
                helper.setTo(order.getUser().getEmail());
                helper.setSubject(safeTitle + " [" + order.getOrderNumber() + "]");
                helper.setText(safeMessage, false);
                mailSender.send(mime);
                emailSent = true;
            } catch (Exception ex) {
                log.warn("Optional admin email failed (in-app notification was saved): {}", ex.getMessage());
            }
        }

        return Map.of(
                "notificationId", saved.getId(),
                "inAppSent", true,
                "emailSent", emailSent,
                "recipient", order.getUser().getEmail()
        );
    }

    // ── Shared Groq helper ──────────────────────────────────────────────────

    private String callGroq(String systemPrompt, String userPrompt, int maxTokens, double temperature) {
        String apiKey = props.getGroq() != null ? props.getGroq().getApiKey() : null;
        if (apiKey == null || apiKey.isBlank()) return null;

        try {
            Map<String, Object> body = Map.of(
                    "model", GROQ_MODEL,
                    "max_tokens", maxTokens,
                    "temperature", temperature,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> resp = webClient.post()
                    .uri("/openai/v1/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (resp != null && resp.get("choices") instanceof List<?> choices && !choices.isEmpty()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> msg = (Map<String, Object>) ((Map<String, Object>) choices.get(0)).get("message");
                if (msg != null && msg.get("content") != null) {
                    return msg.get("content").toString().trim();
                }
            }
        } catch (Exception ex) {
            log.warn("Groq call failed (fallback will be used): {}", ex.getMessage());
        }
        return null;
    }

    private String extractJsonObject(String raw) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return raw.substring(start, end + 1);
        }
        return raw;
    }
}
