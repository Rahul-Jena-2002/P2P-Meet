/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding window rate limiter for REST API endpoints.
 * Defends against meeting creation spam, room code brute forcing, and DoS attacks.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    private static final long WINDOW_DURATION_MS = 60_000L;

    // Client IP -> [windowStartTimeMs, requestCount]
    private final Map<String, long[]> ipRequestMap = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();

        // Apply rate limiting to meeting mutation and lookup endpoints
        if (path.startsWith("/api/meetings")) {
            String clientIp = getClientIp(request);
            long now = System.currentTimeMillis();

            long[] tracker = ipRequestMap.computeIfAbsent(clientIp, k -> new long[]{now, 0});
            boolean rateExceeded = false;

            synchronized (tracker) {
                if (now - tracker[0] > WINDOW_DURATION_MS) {
                    tracker[0] = now;
                    tracker[1] = 0;
                }
                tracker[1]++;
                if (tracker[1] > MAX_REQUESTS_PER_MINUTE) {
                    rateExceeded = true;
                }
            }

            if (rateExceeded) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.setHeader("Retry-After", "60");
                response.getWriter().write("{\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Please wait a minute before retrying.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
