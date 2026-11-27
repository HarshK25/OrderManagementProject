package com.ordermanagement.product.service;

import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.product.repository.ProductSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Tracks customer search queries in a Redis Sorted Set (atomic ZINCRBY)
 * and builds product recommendations from top global searches + optional
 * per-user recent search terms, using ProductSpec's synonym-aware search.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SearchRecommendationService {

    private static final String TOP_SEARCHES_KEY = "oms:search:top_queries";
    private static final List<String> DEFAULT_SEEDS = List.of(
            "shoes", "headphones", "watch", "phone", "fitness", "hoodie"
    );

    private final StringRedisTemplate redisTemplate;
    private final ProductRepository productRepository;

    // Lightweight fallback if Redis is briefly unavailable
    private final Map<String, Double> localFallback = new ConcurrentHashMap<>();

    public void recordSearch(String rawQuery) {
        String normalized = normalize(rawQuery);
        if (normalized == null) return;

        localFallback.merge(normalized, 1.0, Double::sum);
        try {
            redisTemplate.opsForZSet().incrementScore(TOP_SEARCHES_KEY, normalized, 1.0);
        } catch (Exception ex) {
            log.debug("Redis search tracking skipped: {}", ex.getMessage());
        }
    }

    public List<Map<String, Object>> getTrendingSearches(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        List<Map<String, Object>> results = new ArrayList<>();

        try {
            ensureDefaultSeedsInRedis();
            Set<ZSetOperations.TypedTuple<String>> tuples =
                    redisTemplate.opsForZSet().reverseRangeWithScores(TOP_SEARCHES_KEY, 0, safeLimit - 1);
            if (tuples != null) {
                for (ZSetOperations.TypedTuple<String> t : tuples) {
                    if (t.getValue() == null) continue;
                    results.add(Map.of(
                            "query", t.getValue(),
                            "count", t.getScore() != null ? t.getScore().longValue() : 1L
                    ));
                }
            }
        } catch (Exception ex) {
            log.debug("Redis trending fetch fallback: {}", ex.getMessage());
            results = localFallback.entrySet().stream()
                    .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                    .limit(safeLimit)
                    .map(e -> Map.<String, Object>of("query", e.getKey(), "count", e.getValue().longValue()))
                    .collect(Collectors.toList());
        }

        if (results.isEmpty()) {
            for (String seed : DEFAULT_SEEDS.subList(0, Math.min(safeLimit, DEFAULT_SEEDS.size()))) {
                results.add(Map.of("query", seed, "count", 1L));
            }
        }
        return results;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRecommendations(String recentCsv, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 24));
        List<Map<String, Object>> trending = getTrendingSearches(8);

        // Build ordered unique seed terms: user's recent searches first, then global top searches
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        if (recentCsv != null && !recentCsv.isBlank()) {
            for (String part : recentCsv.split(",")) {
                String norm = normalize(part);
                if (norm != null) terms.add(norm);
            }
        }
        for (Map<String, Object> entry : trending) {
            String q = (String) entry.get("query");
            if (q != null) terms.add(q);
        }

        // Collect unique active products matching those search terms (via synonym-aware ProductSpec)
        Map<Long, ProductResponse> matchedById = new LinkedHashMap<>();
        for (String term : terms) {
            if (matchedById.size() >= safeLimit) break;
            Specification<Product> spec = ProductSpec.withFilters(null, null, null, term, true);
            List<Product> hits = productRepository.findAll(
                    spec, PageRequest.of(0, 4, Sort.by("createdAt").descending())
            ).getContent();
            for (Product p : hits) {
                if (p.getStock() > 0 && !matchedById.containsKey(p.getId())) {
                    matchedById.put(p.getId(), ProductResponse.from(p));
                    if (matchedById.size() >= safeLimit) break;
                }
            }
        }

        // Pad with newest active products if needed
        if (matchedById.size() < safeLimit) {
            Specification<Product> activeSpec = ProductSpec.withFilters(null, null, null, null, true);
            List<Product> fallback = productRepository.findAll(
                    activeSpec, PageRequest.of(0, safeLimit, Sort.by("createdAt").descending())
            ).getContent();
            for (Product p : fallback) {
                if (!matchedById.containsKey(p.getId())) {
                    matchedById.put(p.getId(), ProductResponse.from(p));
                    if (matchedById.size() >= safeLimit) break;
                }
            }
        }

        return Map.of(
                "topSearches", trending,
                "basedOn", new ArrayList<>(terms).subList(0, Math.min(terms.size(), 5)),
                "products", new ArrayList<>(matchedById.values())
        );
    }

    private void ensureDefaultSeedsInRedis() {
        Long size = redisTemplate.opsForZSet().zCard(TOP_SEARCHES_KEY);
        if (size == null || size == 0) {
            for (int i = 0; i < DEFAULT_SEEDS.size(); i++) {
                redisTemplate.opsForZSet().addIfAbsent(TOP_SEARCHES_KEY, DEFAULT_SEEDS.get(i), (double) (DEFAULT_SEEDS.size() - i));
            }
        }
    }

    private String normalize(String raw) {
        if (raw == null) return null;
        String cleaned = raw.trim().toLowerCase().replaceAll("\\s+", " ");
        if (cleaned.length() < 2 || cleaned.length() > 60) return null;
        return cleaned;
    }
}
