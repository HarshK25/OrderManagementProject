package com.ordermanagement.product.repository;

import com.ordermanagement.product.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    boolean existsByName(String name);

    /** Used during update to check for duplicates excluding the current row. */
    boolean existsByNameAndIdNot(String name, Long id);

    /** Sorted alphabetically for consistent UI display. */
    List<Category> findAllByOrderByNameAsc();
}
