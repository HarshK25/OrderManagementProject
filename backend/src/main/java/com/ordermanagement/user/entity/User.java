package com.ordermanagement.user.entity;

import com.ordermanagement.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * Application user.
 *
 * Relationship choices:
 *  - Cart is a separate entity (not embedded) because it has its own lifecycle.
 *  - No @OneToMany to orders here to avoid accidentally loading all orders when
 *    we just want to authenticate a user. Navigate from Order → User instead.
 *
 * Security notes:
 *  - passwordHash stores BCrypt output (never the plain password).
 *  - role and status are checked on every request via the JWT filter.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.CUSTOMER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;
}
