package com.ordermanagement.product.service;

import com.ordermanagement.common.exception.ConflictException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.product.dto.CategoryRequest;
import com.ordermanagement.product.dto.CategoryResponse;
import com.ordermanagement.product.entity.Category;
import com.ordermanagement.product.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    // ── Public ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CategoryResponse> listAll() {
        return categoryRepository.findAllByOrderByNameAsc()
                .stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getById(Long id) {
        return CategoryResponse.from(findOrThrow(id));
    }

    // ── Admin ─────────────────────────────────────────────────────────

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        String name = request.getName().trim();
        if (categoryRepository.existsByName(name)) {
            throw new ConflictException("Category already exists: " + name);
        }
        Category saved = categoryRepository.save(
                Category.builder().name(name).build());
        return CategoryResponse.from(saved);
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest request) {
        String name = request.getName().trim();
        if (categoryRepository.existsByNameAndIdNot(name, id)) {
            throw new ConflictException("Another category already uses the name: " + name);
        }
        Category category = findOrThrow(id);
        category.setName(name);
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public void delete(Long id) {
        Category category = findOrThrow(id);
        // Products with this category will have their FK set to NULL (ON DELETE SET NULL in schema)
        categoryRepository.delete(category);
    }

    // ── Internal ──────────────────────────────────────────────────────

    public Category findOrThrow(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }
}
