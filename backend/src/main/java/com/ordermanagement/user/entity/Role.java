package com.ordermanagement.user.entity;

/**
 * User roles — stored as string in the DB via @Enumerated(EnumType.STRING).
 * Spring Security uses this to enforce @PreAuthorize("hasRole('ADMIN')") etc.
 */
public enum Role {
    CUSTOMER,
    ADMIN
}
