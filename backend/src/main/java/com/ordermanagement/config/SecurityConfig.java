package com.ordermanagement.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordermanagement.auth.filter.JwtAuthenticationFilter;
import com.ordermanagement.common.dto.ErrorResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Full stateless JWT security configuration.
 *
 * Public endpoints (no token required):
 *  POST /api/auth/**                — register, login, refresh
 *  GET  /api/products/**            — product catalogue
 *  GET  /api/categories/**          — category list
 *  GET  /api/test/**                — dev-only exception test endpoints
 *  GET  /actuator/**                — health, metrics
 *  GET  /swagger-ui.html, /api-docs — API docs
 *
 * Protected endpoints:
 *  /api/admin/**  → ROLE_ADMIN only
 *  Everything else → any authenticated user
 *
 * 401 and 403 responses are JSON (not HTML redirects) via custom entry points.
 *
 * CORS: configured for the Vite dev server (http://localhost:5173) and
 * any additional origins listed in app.cors.allowed-origins.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity           // enables @PreAuthorize on service/controller methods
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    // ── Filter Chain ──────────────────────────────────────────────────

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // ── Custom 401 / 403 JSON responses ─────────────────────
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(401);
                    response.setContentType("application/json;charset=UTF-8");
                    ErrorResponse err = ErrorResponse.of(401, "UNAUTHORIZED",
                            "Authentication required", request.getRequestURI());
                    response.getWriter().write(objectMapper.writeValueAsString(err));
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(403);
                    response.setContentType("application/json;charset=UTF-8");
                    ErrorResponse err = ErrorResponse.of(403, "ACCESS_DENIED",
                            "You do not have permission to access this resource",
                            request.getRequestURI());
                    response.getWriter().write(objectMapper.writeValueAsString(err));
                })
            )

            // ── Route authorization ───────────────────────────────────
            .authorizeHttpRequests(auth -> auth
                // Public auth endpoints
                .requestMatchers("/api/auth/**").permitAll()

                // Public read-only catalogue
                .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/categories/**").permitAll()

                // Public chatbot — no login required
                .requestMatchers("/api/chat/**").permitAll()

                // Developer test endpoints (only visible in dev profile anyway)
                .requestMatchers("/api/test/**").permitAll()

                // Actuator + API docs
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/api-docs/**").permitAll()

                // Admin-only area
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // Everything else requires authentication
                .anyRequest().authenticated()
            )

            // ── JWT filter before the default username/password filter ──
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

            .authenticationProvider(authenticationProvider());

        return http.build();
    }

    // ── Authentication beans ──────────────────────────────────────────

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    // ── CORS ──────────────────────────────────────────────────────────

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Allowed origins from app.cors.allowed-origins (default: Vite dev server)
        List<String> origins = appProperties.getCors().getAllowedOrigins();
        config.setAllowedOrigins(origins);

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
