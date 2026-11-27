package com.ordermanagement.seller.service;

import com.ordermanagement.ai.dto.GenerateDescriptionRequest;
import com.ordermanagement.ai.service.GeminiService;
import com.ordermanagement.common.exception.BadRequestException;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.product.dto.ProductRequest;
import com.ordermanagement.product.dto.ProductResponse;
import com.ordermanagement.product.entity.Category;
import com.ordermanagement.product.entity.Product;
import com.ordermanagement.product.repository.ProductRepository;
import com.ordermanagement.product.service.CategoryService;
import com.ordermanagement.seller.entity.SellerProfile;
import com.ordermanagement.seller.repository.SellerProfileRepository;
import com.ordermanagement.user.entity.User;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SellerService {

    private final SellerProfileRepository sellerRepo;
    private final ProductRepository productRepository;
    private final CategoryService categoryService;
    private final GeminiService geminiService;
    private final EntityManager em;

    @Transactional(readOnly = true)
    public Map<String, Object> getMySellerDashboard(User user) {
        Optional<SellerProfile> opt = sellerRepo.findByUser(user);
        if (opt.isEmpty()) {
            return Map.of("registered", false);
        }
        SellerProfile profile = opt.get();
        List<ProductResponse> listings = getSellerProducts(profile.getId());

        long activeCount = listings.stream().filter(ProductResponse::isActive).count();
        int totalStock = listings.stream().mapToInt(ProductResponse::getStock).sum();
        BigDecimal inventoryValue = listings.stream()
                .map(p -> p.getEffectivePrice().multiply(BigDecimal.valueOf(p.getStock())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return Map.of(
                "registered", true,
                "profile", toDto(profile),
                "stats", Map.of(
                        "totalProducts", listings.size(),
                        "activeProducts", activeCount,
                        "totalStock", totalStock,
                        "inventoryValue", inventoryValue
                ),
                "products", listings
        );
    }

    @Transactional
    public Map<String, Object> registerSeller(User user, Map<String, Object> body) {
        if (sellerRepo.existsByUser(user)) {
            throw new BadRequestException("You already have a registered seller account.");
        }

        String storeName = reqString(body, "storeName", "Store name is required");
        String businessType = optString(body, "businessType", "INDIVIDUAL").toUpperCase();
        String gstin = optString(body, "gstin", "").toUpperCase();
        String phone = reqString(body, "phone", "Mobile number is required").replaceAll("\\D", "");
        String pickupAddress = reqString(body, "pickupAddress", "Pickup address is required");
        String city = reqString(body, "city", "City is required");
        String state = reqString(body, "state", "State is required");
        String pincode = reqString(body, "pincode", "Pincode is required").replaceAll("\\D", "");
        String bankHolder = optString(body, "bankAccountHolder", user.getName());
        String bankIfsc = optString(body, "bankIfsc", "").toUpperCase();

        if (!phone.matches("^[6-9]\\d{9}$")) {
            throw new BadRequestException("Enter a valid 10-digit Indian mobile number.");
        }
        if (!pincode.matches("^[1-9]\\d{5}$")) {
            throw new BadRequestException("Enter a valid 6-digit Indian pincode.");
        }
        if (!gstin.isEmpty() && !gstin.matches("^[0-9A-Z]{15}$")) {
            throw new BadRequestException("GSTIN must be 15 alphanumeric characters (or leave blank if exempt).");
        }
        if (!bankIfsc.isEmpty() && !bankIfsc.matches("^[A-Z]{4}0[A-Z0-9]{6}$")) {
            throw new BadRequestException("Enter a valid 11-character IFSC code (e.g. HDFC0001234).");
        }

        SellerProfile saved = sellerRepo.save(SellerProfile.builder()
                .user(user)
                .storeName(storeName)
                .businessType(businessType)
                .gstin(gstin.isEmpty() ? null : gstin)
                .phone(phone)
                .pickupAddress(pickupAddress)
                .city(city)
                .state(state)
                .pincode(pincode)
                .bankAccountHolder(bankHolder)
                .bankIfsc(bankIfsc.isEmpty() ? null : bankIfsc)
                .status("APPROVED")
                .build());

        return getMySellerDashboard(saved.getUser());
    }

    @Transactional
    public ProductResponse createSellerProduct(User user, ProductRequest request) {
        SellerProfile profile = requireApprovedSeller(user);
        Category category = request.getCategoryId() != null ? categoryService.findOrThrow(request.getCategoryId()) : null;

        Product product = Product.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .category(category)
                .price(request.getPrice())
                .discountPercent(request.getDiscountPercent() != null ? request.getDiscountPercent() : BigDecimal.ZERO)
                .stock(request.getStock())
                .imageUrl(request.getImageUrl())
                .active(true)
                .sellerId(profile.getId())
                .build();

        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public ProductResponse updateSellerProductStock(User user, Long productId, int stock) {
        SellerProfile profile = requireApprovedSeller(user);
        if (stock < 0) throw new BadRequestException("Stock cannot be negative.");
        Product p = productRepository.findByIdWithCategory(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
        if (!Objects.equals(p.getSellerId(), profile.getId())) {
            throw new BadRequestException("You can only modify your own product listings.");
        }
        p.setStock(stock);
        return ProductResponse.from(productRepository.save(p));
    }

    @Transactional
    public ProductResponse toggleSellerProduct(User user, Long productId) {
        SellerProfile profile = requireApprovedSeller(user);
        Product p = productRepository.findByIdWithCategory(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
        if (!Objects.equals(p.getSellerId(), profile.getId())) {
            throw new BadRequestException("You can only modify your own product listings.");
        }
        p.setActive(!p.isActive());
        return ProductResponse.from(productRepository.save(p));
    }

    public String generateSellerDescription(User user, GenerateDescriptionRequest request) {
        requireApprovedSeller(user);
        return geminiService.generateDescription(request);
    }

    // ── Admin operations ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAllSellers() {
        List<SellerProfile> all = sellerRepo.findAllWithUser();
        List<Map<String, Object>> result = new ArrayList<>();
        for (SellerProfile s : all) {
            long productCount = ((Number) em.createQuery(
                    "SELECT COUNT(p) FROM Product p WHERE p.sellerId = :sid")
                    .setParameter("sid", s.getId())
                    .getSingleResult()).longValue();
            Map<String, Object> dto = new LinkedHashMap<>(toDto(s));
            dto.put("ownerName", s.getUser() != null ? s.getUser().getName() : "");
            dto.put("ownerEmail", s.getUser() != null ? s.getUser().getEmail() : "");
            dto.put("productCount", productCount);
            result.add(dto);
        }
        return result;
    }

    @Transactional
    public Map<String, Object> updateSellerStatus(Long sellerId, String status, String adminNote) {
        SellerProfile s = sellerRepo.findById(sellerId)
                .orElseThrow(() -> new ResourceNotFoundException("Seller", sellerId));
        String upper = (status == null ? "" : status.trim().toUpperCase());
        if (!Set.of("APPROVED", "PENDING", "SUSPENDED", "REJECTED").contains(upper)) {
            throw new BadRequestException("Invalid seller status: " + status);
        }
        s.setStatus(upper);
        if (adminNote != null) s.setAdminNote(adminNote.trim());
        sellerRepo.save(s);
        return toDto(s);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private SellerProfile requireApprovedSeller(User user) {
        SellerProfile profile = sellerRepo.findByUser(user)
                .orElseThrow(() -> new BadRequestException("Please register as a seller first."));
        if (!"APPROVED".equalsIgnoreCase(profile.getStatus())) {
            throw new BadRequestException("Your seller account is currently " + profile.getStatus() + ".");
        }
        return profile;
    }

    private List<ProductResponse> getSellerProducts(Long sellerId) {
        List<Product> list = em.createQuery(
                "SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.sellerId = :sid ORDER BY p.createdAt DESC",
                Product.class)
                .setParameter("sid", sellerId)
                .getResultList();
        return list.stream().map(ProductResponse::from).toList();
    }

    private Map<String, Object> toDto(SellerProfile s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("storeName", s.getStoreName());
        m.put("businessType", s.getBusinessType());
        m.put("gstin", s.getGstin());
        m.put("phone", s.getPhone());
        m.put("pickupAddress", s.getPickupAddress());
        m.put("city", s.getCity());
        m.put("state", s.getState());
        m.put("pincode", s.getPincode());
        m.put("bankAccountHolder", s.getBankAccountHolder());
        m.put("bankIfsc", s.getBankIfsc());
        m.put("status", s.getStatus());
        m.put("adminNote", s.getAdminNote());
        m.put("createdAt", s.getCreatedAt());
        return m;
    }

    private String reqString(Map<String, Object> body, String key, String errMsg) {
        Object val = body.get(key);
        if (val == null || val.toString().trim().isEmpty()) throw new BadRequestException(errMsg);
        return val.toString().trim();
    }

    private String optString(Map<String, Object> body, String key, String fallback) {
        Object val = body.get(key);
        if (val == null || val.toString().trim().isEmpty()) return fallback;
        return val.toString().trim();
    }
}
