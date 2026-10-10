package com.ordermanagement.product.entity;

import com.ordermanagement.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * Flat product category (no nesting — out of scope per project plan).
 * Cached in Redis after Step 7 since the list changes rarely.
 */
@Entity
@Table(name = "categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;
}
