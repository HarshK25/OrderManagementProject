package com.ordermanagement.analytics.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Single aggregate response for the admin analytics dashboard.
 * Returned by GET /api/admin/analytics — one round-trip for the whole page.
 */
public record DashboardDto(

        // ── KPI Cards ────────────────────────────────────────────────────────
        BigDecimal totalRevenue,          // SUM of all PAID/SHIPPED/DELIVERED/REFUNDED order totals
        long       totalOrders,           // COUNT of all orders (any status)
        long       totalCustomers,        // COUNT of distinct users who placed ≥1 order
        BigDecimal avgOrderValue,         // totalRevenue / paid order count
        long       pendingOrders,         // COUNT of PENDING_PAYMENT orders
        long       processingOrders,      // COUNT of PAID + SHIPPED
        BigDecimal totalRefunded,         // SUM of refund_amount from return_requests (REFUNDED)
        long       totalReturns,          // COUNT of return requests

        // ── Revenue over last 30 days (daily) ────────────────────────────────
        List<RevenuePoint> revenueByDay,

        // ── Top 5 products by revenue ─────────────────────────────────────────
        List<TopProduct> topProducts,

        // ── Order status distribution ─────────────────────────────────────────
        List<StatusCount> statusDistribution,

        // ── 5 most recent orders ──────────────────────────────────────────────
        List<RecentOrder> recentOrders

) {
    public record RevenuePoint(String date, BigDecimal revenue, long orderCount) {}

    public record TopProduct(String productName, BigDecimal totalRevenue, long unitsSold, long orderCount) {}

    public record StatusCount(String status, long count) {}

    public record RecentOrder(
            Long id, String orderNumber, String customerName,
            String customerEmail, BigDecimal total, String status, String createdAt
    ) {}
}

