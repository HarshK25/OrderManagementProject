package com.ordermanagement.config;

import com.ordermanagement.user.entity.Role;
import com.ordermanagement.user.entity.User;
import com.ordermanagement.user.entity.UserStatus;
import com.ordermanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the default ADMIN user at startup if none exists.
 *
 * Credentials come from environment variables (with safe defaults for dev):
 *   ADMIN_EMAIL    → app.admin.seed-email    (default: admin@ordermanagement.com)
 *   ADMIN_PASSWORD → app.admin.seed-password (default: Admin@12345)
 *   ADMIN_NAME     → app.admin.seed-name     (default: System Admin)
 *
 * Idempotent: checks by email before inserting — safe to restart the app repeatedly.
 * In production, change the defaults in your environment before first launch.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties appProperties;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AppProperties.Admin adminCfg = appProperties.getAdmin();
        String email = adminCfg.getSeedEmail();

        if (userRepository.existsByEmail(email)) {
            log.debug("Admin user already exists: {}", email);
            return;
        }

        User admin = User.builder()
                .name(adminCfg.getSeedName())
                .email(email)
                .passwordHash(passwordEncoder.encode(adminCfg.getSeedPassword()))
                .role(Role.ADMIN)
                .status(UserStatus.ACTIVE)
                .build();

        userRepository.save(admin);
        log.info("Admin user seeded: {}", email);
    }
}
