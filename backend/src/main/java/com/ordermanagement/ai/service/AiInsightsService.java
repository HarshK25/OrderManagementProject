package com.ordermanagement.ai.service;

import com.ordermanagement.analytics.dto.DashboardDto;
import com.ordermanagement.analytics.service.AnalyticsService;
import com.ordermanagement.config.AppProperties;
import jakarta.persistence.EntityManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Admin AI Insights Assistant grounded in live PostgreSQL order, sales,
 * revenue, and inventory metrics. Uses Groq's OpenAI-compatible API
 * with an automatic live-data summary fallback if the AI provider is unavailable.
 */
@Service
@Slf4j
public class AiInsightsService {

    private final AnalyticsService analyticsService;
    private final EntityManager em;
    private final AppProperties props;
    private final WebClient webClient;

    public AiInsightsService(AnalyticsService analyticsService,
                             EntityManager em,
                             AppProperties props) {
        this.analyticsService = analyticsService;
        this.em = em;
        this.props = props;
        this.webClient = WebClient.builder().baseUrl("https://api.groq.com").build();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> askAssistant(String question) {
        DashboardDto dash = analyticsService.getDashboard();

        long todaysOrders = ((Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM orders WHERE CAST(created_at AT TIME ZONE 'Asia/Kolkata' AS DATE) = CURRENT_DATE")
                .getSingleResult()).longValue();

        String topProductsSummary = dash.topProducts().stream()
                .map(p -> p.productName() + " (₹" + p.totalRevenue() + ", " + p.unitsSold() + " sold)")
                .collect(Collectors.joining("; "));

        String lowStockSummary = dash.lowStockProducts().stream()
                .map(p -> p.name() + " (stock: " + p.stock() + ", ₹" + p.price() + ")")
                .collect(Collectors.joining("; "));

        String statusSummary = dash.statusDistribution().stream()
                .map(s -> s.status() + ": " + s.count())
                .collect(Collectors.joining(", "));

        String context = """
                Live Store Metrics (INR):
                - Total Revenue: ₹%s
                - Total Orders: %d (Today's Orders: %d)
                - Pending Payment Orders: %d
                - Processing/In-Transit Orders: %d
                - Cancelled/Expired Orders: %d
                - Total Customers: %d
                - Average Order Value: ₹%s
                - Active Products: %d
                - Total Returns: %d (Total Refunded: ₹%s)
                - Status Breakdown: %s
                - Top Products: %s
                - Low Stock Products (<= 10 units): %s
                """.formatted(
                dash.totalRevenue(), dash.totalOrders(), todaysOrders,
                dash.pendingOrders(), dash.processingOrders(), dash.cancelledOrders(),
                dash.totalCustomers(), dash.avgOrderValue(), dash.totalProducts(),
                dash.totalReturns(), dash.totalRefunded(),
                statusSummary.isEmpty() ? "None" : statusSummary,
                topProductsSummary.isEmpty() ? "None yet" : topProductsSummary,
                lowStockSummary.isEmpty() ? "All products well-stocked" : lowStockSummary
        );

        String apiKey = props.getGroq() != null ? props.getGroq().getApiKey() : null;
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                Map<String, Object> body = Map.of(
                        "model", "openai/gpt-oss-20b",
                        "max_tokens", 500,
                        "temperature", 0.3,
                        "messages", List.of(
                                Map.of("role", "system", "content",
                                        "You are an enterprise e-commerce analytics & operations AI assistant. " +
                                        "Answer concisely using ONLY the live store metrics provided. Use bullet points and INR (₹) formatting."),
                                Map.of("role", "user", "content", context + "\nAdmin Question: " + question)
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
                        return Map.of("answer", msg.get("content").toString().trim(), "source", "ai");
                    }
                }
            } catch (Exception ex) {
                log.warn("AI insights call failed, falling back to deterministic summary: {}", ex.getMessage());
            }
        }

        // Deterministic live-data fallback
        String fallback = "Live Store Snapshot:\n" + context;
        return Map.of("answer", fallback, "source", "live-metrics");
    }
}
