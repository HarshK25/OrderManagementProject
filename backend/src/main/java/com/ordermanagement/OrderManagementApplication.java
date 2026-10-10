package com.ordermanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Entry point for the E-Commerce Order Management System.
 *
 * Key capabilities enabled here:
 *  - @EnableJpaAuditing  → auto-populates createdAt / updatedAt on BaseEntity
 *  - @EnableCaching      → activates Spring Cache (backed by Redis)
 *  - @EnableAsync        → allows @Async service methods (email dispatch)
 */
@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
public class OrderManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderManagementApplication.class, args);
    }
}
