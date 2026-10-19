package com.ordermanagement.auth.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordermanagement.auth.service.JwtService;
import com.ordermanagement.auth.service.TokenBlacklistService;
import com.ordermanagement.common.dto.ErrorResponse;
import com.ordermanagement.user.entity.User;
import com.ordermanagement.user.entity.UserStatus;
import com.ordermanagement.user.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Stateless JWT authentication filter (runs once per request).
 *
 * Processing pipeline:
 *  1. No Authorization header → skip (unauthenticated request, Spring Security decides later)
 *  2. Parse + verify JWT signature and expiry → 401 on failure
 *  3. Check Redis blacklist (jti) → 401 if blacklisted (logged-out token)
 *  4. Load User from DB → check BLOCKED status → 403 if blocked
 *  5. Set UsernamePasswordAuthenticationToken in SecurityContextHolder
 *
 * The User entity is set as the Principal so controllers can access the full
 * user object via {@code (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal()}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final TokenBlacklistService blacklistService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // No Bearer token — let the request through unauthenticated
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        Claims claims;

        // 1. Validate signature + expiry
        try {
            claims = jwtService.extractAllClaims(token);
        } catch (JwtException e) {
            log.debug("JWT validation failed [{}]: {}", request.getRequestURI(), e.getMessage());
            writeError(response, request, 401, "UNAUTHORIZED", "Invalid or expired token");
            return;
        }

        String jti   = claims.getId();
        String email = claims.getSubject();

        // 2. Check blacklist (logout / revocation)
        if (blacklistService.isBlacklisted(jti)) {
            log.debug("Blacklisted token jti={} rejected", jti);
            writeError(response, request, 401, "UNAUTHORIZED", "Token has been invalidated — please login again");
            return;
        }

        // 3. Skip if SecurityContext already has authentication (shouldn't happen in stateless mode)
        if (email == null || SecurityContextHolder.getContext().getAuthentication() != null) {
            chain.doFilter(request, response);
            return;
        }

        // 4. Load user from DB and check BLOCKED (catches runtime account suspension)
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            chain.doFilter(request, response);
            return;
        }

        if (user.getStatus() == UserStatus.BLOCKED) {
            log.warn("BLOCKED user {} attempted access", email);
            writeError(response, request, 403, "ACCOUNT_BLOCKED", "Your account has been suspended");
            return;
        }

        // 5. Set authentication — role comes from the token claim (no extra DB hit)
        String roleFromToken = claims.get("role", String.class);
        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + roleFromToken))
        );
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authToken);

        chain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, HttpServletRequest request,
                            int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        ErrorResponse error = ErrorResponse.of(status, code, message, request.getRequestURI());
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }
}
