package com.ordermanagement.product.dto;

import com.ordermanagement.product.entity.Category;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResponse {

    private Long id;
    private String name;

    public static CategoryResponse from(Category c) {
        return new CategoryResponse(c.getId(), c.getName());
    }
}
