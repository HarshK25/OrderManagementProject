package com.ordermanagement.coupon.service;

import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.coupon.entity.Coupon;
import com.ordermanagement.coupon.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository couponRepository;

    public List<Coupon> getAllCoupons() {
        return couponRepository.findAll();
    }

    @Transactional
    public Coupon createCoupon(Coupon req) {
        req.setCode(req.getCode().trim().toUpperCase());
        if (couponRepository.findByCodeIgnoreCase(req.getCode()).isPresent()) {
            throw new BadRequestException("Coupon code already exists: " + req.getCode());
        }
        if (req.getUsedCount() == null) req.setUsedCount(0);
        if (req.getMinOrderAmount() == null) req.setMinOrderAmount(BigDecimal.ZERO);
        return couponRepository.save(req);
    }

    @Transactional
    public Coupon toggleCoupon(Long id, boolean active) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", id));
        coupon.setActive(active);
        return couponRepository.save(coupon);
    }

    @Transactional
    public void deleteCoupon(Long id) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", id));
        couponRepository.delete(coupon);
    }

    /**
     * Validates a coupon against an order amount and returns the calculated discount.
     */
    public BigDecimal calculateDiscount(String code, BigDecimal orderAmount) {
        Coupon coupon = couponRepository.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new BadRequestException("Invalid coupon code: " + code));

        if (!coupon.isActive()) {
            throw new BadRequestException("Coupon " + coupon.getCode() + " is inactive");
        }
        if (coupon.getExpiresAt() != null && LocalDateTime.now().isAfter(coupon.getExpiresAt())) {
            throw new BadRequestException("Coupon " + coupon.getCode() + " has expired");
        }
        if (coupon.getUsageLimit() != null && coupon.getUsedCount() >= coupon.getUsageLimit()) {
            throw new BadRequestException("Coupon " + coupon.getCode() + " usage limit reached");
        }
        if (orderAmount.compareTo(coupon.getMinOrderAmount()) < 0) {
            throw new BadRequestException("Minimum order amount for " + coupon.getCode()
                    + " is ₹" + coupon.getMinOrderAmount());
        }

        BigDecimal discount;
        if ("PERCENTAGE".equalsIgnoreCase(coupon.getDiscountType())) {
            discount = orderAmount.multiply(coupon.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (coupon.getMaxDiscount() != null && discount.compareTo(coupon.getMaxDiscount()) > 0) {
                discount = coupon.getMaxDiscount();
            }
        } else {
            discount = coupon.getDiscountValue();
        }

        if (discount.compareTo(orderAmount) > 0) {
            discount = orderAmount;
        }
        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    @Transactional
    public void incrementUsage(String code) {
        couponRepository.findByCodeIgnoreCase(code.trim()).ifPresent(c -> {
            c.setUsedCount((c.getUsedCount() == null ? 0 : c.getUsedCount()) + 1);
            couponRepository.save(c);
        });
    }
}
