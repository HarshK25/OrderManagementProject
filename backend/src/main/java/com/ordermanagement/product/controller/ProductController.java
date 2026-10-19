package com.ordermanagement.product.controller;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.product.dto.ProductRequest;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.product.dto.StockAdjustRequest;
import com.ordermanagement.product.service.ProductService;
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

    // ── Public ────────────────────────────────────────────────────────

    @GetMapping("/api/products")
    @Operation(summary = "Browse active products with optional filters and pagination")
    public PagedResponse<ProductResponse> listPublic(
            @Parameter(description = "Filter by category ID") @RequestParam(required = false) Long categoryId,
            @Parameter(description = "Minimum price (inclusive)") @RequestParam(required = false) BigDecimal minPrice,
            @Parameter(description = "Maximum price (inclusive)") @RequestParam(required = false) BigDecimal maxPrice,
            @Parameter(description = "Search in product name") @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "12")  int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Pageable pageable = buildPageable(page, size, sortBy, direction);
        return productService.getPublicProducts(categoryId, minPrice, maxPrice, search, pageable);
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
