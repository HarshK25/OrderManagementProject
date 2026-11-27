package com.ordermanagement.coupon.controller;

import com.ordermanagement.coupon.entity.Coupon;
import com.ordermanagement.coupon.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Coupons", description = "Discount coupon validation and admin management")
@SecurityRequirement(name = "bearerAuth")
public class CouponController {

    private final CouponService couponService;

    @GetMapping("/api/coupons/validate")
    @Operation(summary = "Validate a coupon code for a given cart total")
    public Map<String, Object> validate(@RequestParam String code,
                                        @RequestParam BigDecimal amount) {
        BigDecimal discount = couponService.calculateDiscount(code, amount);
        return Map.of(
                "code", code.trim().toUpperCase(),
                "discount", discount,
                "finalAmount", amount.subtract(discount)
        );
    }

    @GetMapping("/api/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all coupons (admin)")
    public List<Coupon> listAll() {
        return couponService.getAllCoupons();
    }

    @PostMapping("/api/admin/coupons")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new coupon (admin)")
    public Coupon create(@RequestBody Coupon coupon) {
        return couponService.createCoupon(coupon);
    }

    @PatchMapping("/api/admin/coupons/{id}/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Activate or deactivate a coupon (admin)")
    public Coupon toggle(@PathVariable Long id, @RequestParam boolean active) {
        return couponService.toggleCoupon(id, active);
    }

    @DeleteMapping("/api/admin/coupons/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete a coupon (admin)")
    public void delete(@PathVariable Long id) {
        couponService.deleteCoupon(id);
    }
}
