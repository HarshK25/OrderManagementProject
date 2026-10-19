package com.ordermanagement.product.controller;

import com.ordermanagement.product.dto.CategoryRequest;
import com.ordermanagement.product.dto.CategoryResponse;
import com.ordermanagement.product.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Category endpoints.
 *
 * Public (no auth):
 *   GET  /api/categories          — list all categories (alphabetical)
 *   GET  /api/categories/{id}     — single category
 *
 * Admin only:
 *   POST   /api/admin/categories        — create
 *   PUT    /api/admin/categories/{id}   — update name
 *   DELETE /api/admin/categories/{id}   — delete (products become uncategorised)
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Categories", description = "Category management")
public class CategoryController {

    private final CategoryService categoryService;

    // ── Public ────────────────────────────────────────────────────────

    @GetMapping("/api/categories")
    @Operation(summary = "List all categories (alphabetical)")
    public List<CategoryResponse> listAll() {
        return categoryService.listAll();
    }

    @GetMapping("/api/categories/{id}")
    @Operation(summary = "Get a single category by ID")
    public CategoryResponse getById(@PathVariable Long id) {
        return categoryService.getById(id);
    }

    // ── Admin ─────────────────────────────────────────────────────────

    @PostMapping("/api/admin/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a category", security = @SecurityRequirement(name = "bearerAuth"))
    public CategoryResponse create(@Valid @RequestBody CategoryRequest request) {
        return categoryService.create(request);
    }

    @PutMapping("/api/admin/categories/{id}")
    @Operation(summary = "Update a category name", security = @SecurityRequirement(name = "bearerAuth"))
    public CategoryResponse update(@PathVariable Long id,
                                   @Valid @RequestBody CategoryRequest request) {
        return categoryService.update(id, request);
    }

    @DeleteMapping("/api/admin/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a category (products become uncategorised)",
               security = @SecurityRequirement(name = "bearerAuth"))
    public void delete(@PathVariable Long id) {
        categoryService.delete(id);
    }
}
