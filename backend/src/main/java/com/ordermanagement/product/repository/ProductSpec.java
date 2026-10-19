package com.ordermanagement.product.repository;

import com.ordermanagement.product.entity.Product;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA Specifications for dynamic product filtering.
 *
 * Combines any subset of: category, price range, name search, and active flag.
 * Each filter is optional — null means "no constraint".
 *
 * Used by ProductService to build the Specification passed to
 * {@code productRepository.findAll(spec, pageable)}.
 */
public class ProductSpec {

    private ProductSpec() {}

    public static Specification<Product> withFilters(
            Long categoryId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String search,
            Boolean active) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            }

            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            }

            if (search != null && !search.isBlank()) {
                // Case-insensitive LIKE on name field
                predicates.add(cb.like(
                        cb.lower(root.get("name")),
                        "%" + search.toLowerCase() + "%"
                ));
            }

            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
