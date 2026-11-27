package com.ordermanagement.product.controller;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.product.dto.ProductRequest;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.ai.service.AiCommerceService;
import com.ordermanagement.product.dto.StockAdjustRequest;
import com.ordermanagement.product.service.ProductService;
import com.ordermanagement.product.service.SearchRecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Product endpoints.
 *
 * Public (no auth):
 *   GET  /api/products               — paginated, filterable product list
 *   GET  /api/products/{id}          — single active product
 *
 * Admin only:
 *   GET    /api/admin/products               — paginated list (includes inactive)
 *   GET    /api/admin/products/{id}          — any product (active or not)
 *   POST   /api/admin/products               — create
 *   PUT    /api/admin/products/{id}          — full update
 *   PATCH  /api/admin/products/{id}/toggle-active  — soft delete / restore
 *   PATCH  /api/admin/products/{id}/stock    — manual stock adjustment
 *
 * Pagination defaults: page=0, size=12, sort=createdAt,desc
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Products", description = "Product catalogue management")
public class ProductController {

    private final ProductService productService;
    private final SearchRecommendationService searchRecommendationService;
    private final AiCommerceService aiCommerceService;

    // ── Public ────────────────────────────────────────────────────────

    @GetMapping("/api/products")
    @Operation(summary = "Browse active products with optional filters and pagination")
    public PagedResponse<ProductResponse> listPublic(
            @Parameter(description = "Filter by category ID") @RequestParam(required = false) Long categoryId,
            @Parameter(description = "Minimum price (inclusive)") @RequestParam(required = false) BigDecimal minPrice,
            @Parameter(description = "Maximum price (inclusive)") @RequestParam(required = false) BigDecimal maxPrice,
            @Parameter(description = "Search in product name, description, or category") @RequestParam(required = false) String search,
            @Parameter(description = "Alias for search") @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "12")  int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        String effectiveSearch = (search != null && !search.isBlank()) ? search : q;
        if (effectiveSearch != null && !effectiveSearch.isBlank()) {
            searchRecommendationService.recordSearch(effectiveSearch);
        }
        Pageable pageable = buildPageable(page, size, sortBy, direction);
        return productService.getPublicProducts(categoryId, minPrice, maxPrice, effectiveSearch, pageable);
    }

    @GetMapping("/api/products/trending-searches")
    @Operation(summary = "Get top searched keywords across the store")
    public Map<String, Object> trendingSearches(
            @RequestParam(defaultValue = "8") int limit) {
        List<Map<String, Object>> queries = searchRecommendationService.getTrendingSearches(limit);
        return Map.of("queries", queries);
    }

    @GetMapping("/api/products/recommendations")
    @Operation(summary = "Get recommended products based on top global searches and user recent searches")
    public Map<String, Object> recommendations(
            @Parameter(description = "Comma-separated recent search queries from client") @RequestParam(required = false) String recent,
            @RequestParam(defaultValue = "8") int limit) {
        return searchRecommendationService.getRecommendations(recent, limit);
    }

    @GetMapping("/api/products/smart-search")
    @Operation(summary = "Natural-language / intent shopping search (e.g. 'running shoes under 6000')")
    public Map<String, Object> smartSearch(@RequestParam String q) {
        return aiCommerceService.smartSearch(q);
    }

    @GetMapping("/api/products/compare")
    @Operation(summary = "Compare 2-3 products side-by-side with an AI verdict")
    public Map<String, Object> compareProducts(@RequestParam List<Long> ids) {
        return aiCommerceService.compareProducts(ids);
    }

    @GetMapping("/api/products/{id}/frequently-bought-together")
    @Operation(summary = "Get products frequently bought together with the given product")
    public Map<String, Object> frequentlyBoughtTogether(
            @PathVariable Long id,
            @RequestParam(defaultValue = "3") int limit) {
        return aiCommerceService.frequentlyBoughtTogether(id, limit);
    }

    @GetMapping("/api/products/{id}")
    @Operation(summary = "Get a single active product by ID")
    public ProductResponse getPublicById(@PathVariable Long id) {
        return productService.getPublicProductById(id);
    }

    // ── Admin ─────────────────────────────────────────────────────────

    @GetMapping("/api/admin/products")
    @Operation(summary = "List all products including inactive (admin)",
               security = @SecurityRequirement(name = "bearerAuth"))
    public PagedResponse<ProductResponse> listAdmin(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "20")  int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Pageable pageable = buildPageable(page, size, sortBy, direction);
        return productService.getAdminProducts(categoryId, minPrice, maxPrice, search, active, pageable);
    }

    @GetMapping("/api/admin/products/{id}")
    @Operation(summary = "Get any product by ID (admin)", security = @SecurityRequirement(name = "bearerAuth"))
    public ProductResponse getAdminById(@PathVariable Long id) {
        return productService.getAdminProductById(id);
    }

    @PostMapping("/api/admin/products")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a product", security = @SecurityRequirement(name = "bearerAuth"))
    public ProductResponse create(@Valid @RequestBody ProductRequest request) {
        return productService.create(request);
    }

    @PutMapping("/api/admin/products/{id}")
    @Operation(summary = "Update a product", security = @SecurityRequirement(name = "bearerAuth"))
    public ProductResponse update(@PathVariable Long id,
                                  @Valid @RequestBody ProductRequest request) {
        return productService.update(id, request);
    }

    @PatchMapping("/api/admin/products/{id}/toggle-active")
    @Operation(summary = "Toggle product active/inactive (soft delete)",
               security = @SecurityRequirement(name = "bearerAuth"))
    public ProductResponse toggleActive(@PathVariable Long id) {
        return productService.toggleActive(id);
    }

    @PatchMapping("/api/admin/products/{id}/stock")
    @Operation(summary = "Manually adjust product stock (positive = add, negative = remove)",
               security = @SecurityRequirement(name = "bearerAuth"))
    public ProductResponse adjustStock(@PathVariable Long id,
                                       @Valid @RequestBody StockAdjustRequest request) {
        return productService.adjustStock(id, request);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private Pageable buildPageable(int page, int size, String sortBy, String direction) {
        // Guard against absurd page sizes
        int safeSize = Math.min(size, 100);
        Sort sort = "asc".equalsIgnoreCase(direction)
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        return PageRequest.of(page, safeSize, sort);
    }
}
