package com.ordermanagement.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Generic paginated API response wrapper.
 *
 * Wraps Spring's {@link Page} into a stable, versioned JSON shape that the
 * frontend can depend on regardless of internal Spring Data changes.
 *
 * Usage in a service/controller:
 * <pre>
 *   Page&lt;ProductDto&gt; page = productRepository.findAll(spec, pageable);
 *   return PagedResponse.from(page);
 * </pre>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PagedResponse<T> {

    /** The items on this page. */
    private List<T> content;

    /** Zero-based page number. */
    private int page;

    /** Requested page size. */
    private int size;

    /** Total number of items across all pages. */
    private long totalElements;

    /** Total number of pages. */
    private int totalPages;

    /** True if this is the last page. */
    private boolean last;

    /**
     * Build from a Spring {@link Page}.
     * The content list should already be mapped to DTOs before calling this.
     */
    public static <T> PagedResponse<T> from(Page<T> page) {
        return new PagedResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast()
        );
    }
}
