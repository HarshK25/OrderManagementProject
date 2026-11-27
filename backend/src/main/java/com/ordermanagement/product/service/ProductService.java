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
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

        String effectiveSearch = search;
        BigDecimal effectiveMin = minPrice;
        BigDecimal effectiveMax = maxPrice;

        // Automatically handle natural-language price phrases in the main search bar
        // e.g. "shoes under 6000", "headphones below 10000", "watch between 2000 and 10000"
        if (effectiveSearch != null && !effectiveSearch.isBlank()) {
            String lower = effectiveSearch.toLowerCase();
            Matcher between = Pattern.compile("between\\s*₹?\\s*(\\d+)\\s*(?:and|to|-)\\s*₹?\\s*(\\d+)").matcher(lower);
            if (between.find()) {
                if (effectiveMin == null) effectiveMin = new BigDecimal(between.group(1));
                if (effectiveMax == null) effectiveMax = new BigDecimal(between.group(2));
                effectiveSearch = effectiveSearch.replaceAll("(?i)between\\s*₹?\\s*\\d+\\s*(?:and|to|-)\\s*₹?\\s*\\d+", " ");
            } else {
                Matcher under = Pattern.compile("(?:under|below|less than|max|upto|up to|<=)\\s*₹?\\s*(\\d+)").matcher(lower);
                if (under.find()) {
                    if (effectiveMax == null) effectiveMax = new BigDecimal(under.group(1));
                    effectiveSearch = effectiveSearch.replaceAll("(?i)(?:under|below|less than|max|upto|up to|<=)\\s*₹?\\s*\\d+", " ");
                }
                Matcher hiUnder = Pattern.compile("₹?\\s*(\\d+)\\s*(?:ke\\s+andar|se\\s+kam|tak)").matcher(lower);
                if (hiUnder.find()) {
                    if (effectiveMax == null) effectiveMax = new BigDecimal(hiUnder.group(1));
                    effectiveSearch = effectiveSearch.replaceAll("(?i)₹?\\s*\\d+\\s*(?:ke\\s+andar|se\\s+kam|tak)", " ");
                }
                Matcher above = Pattern.compile("(?:above|over|more than|min|>=)\\s*₹?\\s*(\\d+)").matcher(lower);
                if (above.find()) {
                    if (effectiveMin == null) effectiveMin = new BigDecimal(above.group(1));
                    effectiveSearch = effectiveSearch.replaceAll("(?i)(?:above|over|more than|min|>=)\\s*₹?\\s*\\d+", " ");
                }
                Matcher hiAbove = Pattern.compile("₹?\\s*(\\d+)\\s*(?:se\\s+upar|se\\s+jyada|se\\s+zyada)").matcher(lower);
                if (hiAbove.find()) {
                    if (effectiveMin == null) effectiveMin = new BigDecimal(hiAbove.group(1));
                    effectiveSearch = effectiveSearch.replaceAll("(?i)₹?\\s*\\d+\\s*(?:se\\s+upar|se\\s+jyada|se\\s+zyada)", " ");
                }
            }
            effectiveSearch = effectiveSearch.replaceAll("\\s+", " ").trim();
            if (effectiveSearch.isEmpty()) effectiveSearch = null;
        }

        Specification<Product> spec = ProductSpec.withFilters(
                categoryId, effectiveMin, effectiveMax, effectiveSearch, true);
        Page<ProductResponse> page = productRepository.findAll(spec, pageable)
                .map(ProductResponse::from);
        PagedResponse<ProductResponse> response = PagedResponse.from(page);

        // Auto-correct misspelled search queries (Damerau-Levenshtein against catalog vocabulary)
        if (response.getTotalElements() == 0 && effectiveSearch != null && !effectiveSearch.isBlank()) {
            String corrected = correctSpelling(effectiveSearch);
            if (corrected != null && !corrected.equalsIgnoreCase(effectiveSearch)) {
                Specification<Product> correctedSpec = ProductSpec.withFilters(
                        categoryId, effectiveMin, effectiveMax, corrected, true);
                Page<ProductResponse> correctedPage = productRepository.findAll(correctedSpec, pageable)
                        .map(ProductResponse::from);
                if (correctedPage.getTotalElements() > 0) {
                    PagedResponse<ProductResponse> correctedResp = PagedResponse.from(correctedPage);
                    correctedResp.setCorrectedQuery(corrected);
                    return correctedResp;
                }
            }
        }

        return response;
    }

    /**
     * Corrects misspelled tokens in a search query against active product names,
     * category names, and known e-commerce synonyms using Damerau-Levenshtein distance.
     */
    public String correctSpelling(String rawSearch) {
        if (rawSearch == null || rawSearch.isBlank()) return rawSearch;
        Set<String> vocab = buildCatalogVocabulary();
        String[] tokens = rawSearch.trim().toLowerCase().split("[^a-z0-9]+");
        List<String> correctedTokens = new ArrayList<>();
        boolean anyChanged = false;

        for (String token : tokens) {
            if (token.isEmpty()) continue;
            if (token.length() < 3 || vocab.contains(token)) {
                correctedTokens.add(token);
                continue;
            }
            String best = findClosestWord(token, vocab);
            if (best != null && !best.equals(token)) {
                correctedTokens.add(best);
                anyChanged = true;
            } else {
                correctedTokens.add(token);
            }
        }
        return anyChanged ? String.join(" ", correctedTokens) : rawSearch;
    }

    private Set<String> buildCatalogVocabulary() {
        Set<String> vocab = new LinkedHashSet<>(ProductSpec.getAllSynonymWords());
        for (Product p : productRepository.findAll()) {
            if (!p.isActive()) continue;
            addWords(vocab, p.getName());
            if (p.getCategory() != null) addWords(vocab, p.getCategory().getName());
        }
        return vocab;
    }

    private void addWords(Set<String> vocab, String text) {
        if (text == null) return;
        for (String w : text.toLowerCase().split("[^a-z0-9]+")) {
            if (w.length() >= 3) vocab.add(w);
        }
    }

    private String findClosestWord(String input, Set<String> vocab) {
        int maxDist = input.length() <= 4 ? 1 : (input.length() <= 8 ? 2 : 3);
        String bestWord = null;
        int bestDist = maxDist + 1;
        boolean bestSameFirst = false;

        for (String candidate : vocab) {
            if (Math.abs(candidate.length() - input.length()) > maxDist) continue;
            int d = damerauLevenshtein(input, candidate);
            if (d <= maxDist) {
                boolean sameFirst = candidate.charAt(0) == input.charAt(0);
                if (d < bestDist || (d == bestDist && sameFirst && !bestSameFirst)) {
                    bestDist = d;
                    bestWord = candidate;
                    bestSameFirst = sameFirst;
                }
            }
        }
        return bestWord;
    }

    private int damerauLevenshtein(String a, String b) {
        int n = a.length(), m = b.length();
        int[][] dp = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) dp[i][0] = i;
        for (int j = 0; j <= m; j++) dp[0][j] = j;
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                int cost = (a.charAt(i - 1) == b.charAt(j - 1)) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                );
                if (i > 1 && j > 1
                        && a.charAt(i - 1) == b.charAt(j - 2)
                        && a.charAt(i - 2) == b.charAt(j - 1)) {
                    dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
                }
            }
        }
        return dp[n][m];
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
