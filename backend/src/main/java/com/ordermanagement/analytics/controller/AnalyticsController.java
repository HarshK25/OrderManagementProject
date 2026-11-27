package com.ordermanagement.analytics.controller;

import com.ordermanagement.analytics.dto.DashboardDto;
import com.ordermanagement.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin analytics dashboard endpoint.
 *
 * GET /api/admin/analytics  →  full dashboard in one round-trip
 *
 * Protected by /api/admin/** rule in SecurityConfig (ROLE_ADMIN only).
 */
@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping
    public DashboardDto getDashboard() {
        return analyticsService.getDashboard();
    }

    @GetMapping(value = "/export/orders", produces = "text/csv")
    public org.springframework.http.ResponseEntity<String> exportOrdersCsv() {
        String csv = analyticsService.exportOrdersCsv();
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=orders-export.csv")
                .body(csv);
    }
}

