package com.ordermanagement.analytics.service;

import com.ordermanagement.analytics.dto.DashboardDto;
import com.ordermanagement.analytics.dto.DashboardDto.*;
import com.ordermanagement.order.entity.OrderStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Analytics queries using JPQL + native SQL for aggregate reporting.
 * No new tables needed — everything is computed from orders, order_items, users, return_requests.
 *
 * Performance note: these queries hit the DB directly (no cache) and are
 * read-only. In production you'd add a materialized view or Redis TTL cache.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final EntityManager em;

    // Statuses that represent real revenue (payment captured)
    private static final List<String> REVENUE_STATUSES = List.of(
            "PAID", "SHIPPED", "DELIVERED",
            "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED",
            "PICKUP_COMPLETED", "REFUNDED"
    );

    @Transactional(readOnly = true)
    public DashboardDto getDashboard() {
        return new DashboardDto(
                getTotalRevenue(),
                getTotalOrders(),
                getTotalCustomers(),
                getAvgOrderValue(),
                getOrderCountByStatus("PENDING_PAYMENT"),
                getOrderCountByStatus("PAID") + getOrderCountByStatus("SHIPPED"),
                getTotalRefunded(),
                getTotalReturns(),
                getRevenueByDay(),
                getTopProducts(),
                getStatusDistribution(),
                getRecentOrders()
        );
    }

    // ── KPI helpers ──────────────────────────────────────────────────────────

    private BigDecimal getTotalRevenue() {
        String jpql = "SELECT COALESCE(SUM(o.total), 0) FROM Order o WHERE o.status IN :statuses";
        Object result = em.createQuery(jpql)
                .setParameter("statuses", REVENUE_STATUSES.stream()
                        .map(OrderStatus::valueOf).collect(Collectors.toList()))
                .getSingleResult();
        return toBigDecimal(result);
    }

    private long getTotalOrders() {
        return (long) em.createQuery("SELECT COUNT(o) FROM Order o").getSingleResult();
    }

    private long getTotalCustomers() {
        return (long) em.createQuery(
                "SELECT COUNT(DISTINCT o.user.id) FROM Order o").getSingleResult();
    }

    private BigDecimal getAvgOrderValue() {
        String jpql = "SELECT COALESCE(AVG(o.total), 0) FROM Order o WHERE o.status IN :statuses";
        Object result = em.createQuery(jpql)
                .setParameter("statuses", REVENUE_STATUSES.stream()
                        .map(OrderStatus::valueOf).collect(Collectors.toList()))
                .getSingleResult();
        return toBigDecimal(result).setScale(2, RoundingMode.HALF_UP);
    }

    private long getOrderCountByStatus(String status) {
        return (long) em.createQuery("SELECT COUNT(o) FROM Order o WHERE o.status = :s")
                .setParameter("s", OrderStatus.valueOf(status))
                .getSingleResult();
    }

    private BigDecimal getTotalRefunded() {
        // Use native query since ReturnRequest is in a different package
        Query q = em.createNativeQuery(
                "SELECT COALESCE(SUM(refund_amount), 0) FROM return_requests WHERE refund_amount IS NOT NULL");
        return toBigDecimal(q.getSingleResult());
    }

    private long getTotalReturns() {
        Query q = em.createNativeQuery("SELECT COUNT(*) FROM return_requests");
        return ((Number) q.getSingleResult()).longValue();
    }

    // ── Revenue by day (last 30 days) ────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<RevenuePoint> getRevenueByDay() {
        // Use native query for DATE_TRUNC / CAST DATE support across PostgreSQL
        String sql = """
                SELECT
                    CAST(created_at AT TIME ZONE 'Asia/Kolkata' AS DATE) AS day,
                    COALESCE(SUM(total), 0)                               AS revenue,
                    COUNT(*)                                               AS order_count
                FROM orders
                WHERE status IN ('PAID','SHIPPED','DELIVERED',
                                 'RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED',
                                 'PICKUP_COMPLETED','REFUNDED')
                  AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY day
                ORDER BY day ASC
                """;

        List<Object[]> rows = em.createNativeQuery(sql).getResultList();

        // Build a map of date → data, then fill in missing days with 0
        Map<LocalDate, RevenuePoint> map = new LinkedHashMap<>();
        for (Object[] row : rows) {
            LocalDate date = ((java.sql.Date) row[0]).toLocalDate();
            BigDecimal rev = toBigDecimal(row[1]);
            long cnt = ((Number) row[2]).longValue();
            map.put(date, new RevenuePoint(date.toString(), rev, cnt));
        }

        // Fill all 30 days (zeros for days with no orders)
        List<RevenuePoint> result = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = 29; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            result.add(map.getOrDefault(d, new RevenuePoint(d.toString(), BigDecimal.ZERO, 0L)));
        }
        return result;
    }

    // ── Top 5 products by revenue ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<TopProduct> getTopProducts() {
        String sql = """
                SELECT
                    oi.product_name,
                    COALESCE(SUM(oi.line_total), 0) AS total_revenue,
                    COALESCE(SUM(oi.quantity), 0)   AS units_sold,
                    COUNT(DISTINCT oi.order_id)      AS order_count
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE o.status IN ('PAID','SHIPPED','DELIVERED',
                                   'RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED',
                                   'PICKUP_COMPLETED','REFUNDED')
                GROUP BY oi.product_name
                ORDER BY total_revenue DESC
                LIMIT 5
                """;

        List<Object[]> rows = em.createNativeQuery(sql).getResultList();
        return rows.stream().map(r -> new TopProduct(
                (String) r[0],
                toBigDecimal(r[1]),
                ((Number) r[2]).longValue(),
                ((Number) r[3]).longValue()
        )).toList();
    }

    // ── Order status distribution ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<StatusCount> getStatusDistribution() {
        String jpql = "SELECT o.status, COUNT(o) FROM Order o GROUP BY o.status ORDER BY COUNT(o) DESC";
        List<Object[]> rows = em.createQuery(jpql).getResultList();
        return rows.stream()
                .map(r -> new StatusCount(r[0].toString(), (long) r[1]))
                .toList();
    }

    // ── 5 most recent orders ──────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<RecentOrder> getRecentOrders() {
        String jpql = """
                SELECT o.id, o.orderNumber, o.user.name, o.user.email,
                       o.total, o.status, o.createdAt
                FROM Order o
                ORDER BY o.createdAt DESC
                """;
        List<Object[]> rows = em.createQuery(jpql).setMaxResults(8).getResultList();
        return rows.stream().map(r -> new RecentOrder(
                (Long)   r[0],
                (String) r[1],
                (String) r[2],
                (String) r[3],
                toBigDecimal(r[4]),
                r[5].toString(),
                r[6].toString()
        )).toList();
    }

    // ── Util ──────────────────────────────────────────────────────────────────

    private BigDecimal toBigDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Double d) return BigDecimal.valueOf(d);
        if (o instanceof Long l) return BigDecimal.valueOf(l);
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return BigDecimal.ZERO;
    }
}

