package com.ordermanagement.product.service;

import com.ordermanagement.common.dto.PagedResponse;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.product.dto.ProductRequest;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.product.dto.StockAdjustRequest;
import com.ordermanagement.product.entity.Category;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.product.repository.ProductSpec;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Product business logic.
 *
 * Public vs Admin filtering:
 *  - Public callers always force active=true so inactive products are invisible
 *  - Admin callers pass active=null to see all products
 *
 * Stock management:
 *  - Manual admin adjustment: additive delta (positive = add, negative = remove)
 *  - Order placement uses the atomic decrementStockIfAvailable in the repository
 *    directly from OrderService — never through this service, to avoid a
 *    read-then-write race condition.
 */
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryService categoryService;

    // ── Public ────────────────────────────────────────────────────────

    /**
     * Paginated product list for customers — always filters to active=true.
     */
    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> getPublicProducts(
            Long categoryId, BigDecimal minPrice, BigDecimal maxPrice,
            String search, Pageable pageable) {

        Specification<Product> spec = ProductSpec.withFilters(
                categoryId, minPrice, maxPrice, search, true);
        Page<ProductResponse> page = productRepository.findAll(spec, pageable)
                .map(ProductResponse::from);
        return PagedResponse.from(page);
    }

    /**
     * Single active product — 404 if inactive or missing.
     */
    @Transactional(readOnly = true)
    public ProductResponse getPublicProductById(Long id) {
        Product p = productRepository.findByIdWithCategory(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
        if (!p.isActive()) {
            throw new ResourceNotFoundException("Product", id);
        }
        return ProductResponse.from(p);
    }

    // ── Admin ─────────────────────────────────────────────────────────

    /**
     * Paginated product list for admin — can filter by active flag (null = all).
     */
    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> getAdminProducts(
            Long categoryId, BigDecimal minPrice, BigDecimal maxPrice,
            String search, Boolean active, Pageable pageable) {

        Specification<Product> spec = ProductSpec.withFilters(
                categoryId, minPrice, maxPrice, search, active);
        Page<ProductResponse> page = productRepository.findAll(spec, pageable)
                .map(ProductResponse::from);
        return PagedResponse.from(page);
    }

    @Transactional(readOnly = true)
    public ProductResponse getAdminProductById(Long id) {
        return ProductResponse.from(findOrThrow(id));
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        Category category = resolveCategory(request.getCategoryId());
        Product product = buildProduct(new Product(), request, category);
        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findOrThrow(id);
        Category category = resolveCategory(request.getCategoryId());
        buildProduct(product, request, category);
        return ProductResponse.from(productRepository.save(product));
    }

    /**
     * Toggle active flag — soft delete / restore.
     */
    @Transactional
    public ProductResponse toggleActive(Long id) {
        Product product = findOrThrow(id);
        product.setActive(!product.isActive());
        return ProductResponse.from(productRepository.save(product));
    }

    /**
     * Manual stock adjustment by admin.
     * The resulting stock must be >= 0.
     */
    @Transactional
    public ProductResponse adjustStock(Long id, StockAdjustRequest request) {
        Product product = findOrThrow(id);
        int newStock = product.getStock() + request.getDelta();
        if (newStock < 0) {
            throw new BadRequestException(
                    "Cannot reduce stock below 0 — current: " + product.getStock()
                    + ", delta: " + request.getDelta());
        }
        product.setStock(newStock);
        return ProductResponse.from(productRepository.save(product));
    }

    // ── Internal helpers ──────────────────────────────────────────────

    public Product findOrThrow(Long id) {
        return productRepository.findByIdWithCategory(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    private Category resolveCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categoryService.findOrThrow(categoryId);
    }

    private Product buildProduct(Product product, ProductRequest request, Category category) {
        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setCategory(category);
        product.setPrice(request.getPrice());
        product.setDiscountPercent(
                request.getDiscountPercent() != null
                        ? request.getDiscountPercent()
                        : BigDecimal.ZERO);
        product.setStock(request.getStock());
        product.setImageUrl(request.getImageUrl());
        product.setActive(request.isActive());
        return product;
    }
}
