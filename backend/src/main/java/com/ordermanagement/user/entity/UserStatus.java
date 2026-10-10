package com.ordermanagement.user.entity;

/**
 * Account status.
 * BLOCKED users are rejected at the JWT filter even if their token is still valid,
 * by loading the user from the DB on every request and checking this field.
 */
public enum UserStatus {
    ACTIVE,
    BLOCKED
}
