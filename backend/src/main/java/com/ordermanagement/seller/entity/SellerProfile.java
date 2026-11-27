package com.ordermanagement.seller.entity;

import com.ordermanagement.common.entity.BaseEntity;
import com.ordermanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "seller_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SellerProfile extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "store_name", nullable = false, length = 150)
    private String storeName;

    @Column(name = "business_type", nullable = false, length = 60)
    @Builder.Default
    private String businessType = "INDIVIDUAL";

    @Column(length = 20)
    private String gstin;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "pickup_address", nullable = false, length = 500)
    private String pickupAddress;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(nullable = false, length = 100)
    private String state;

    @Column(nullable = false, length = 10)
    private String pincode;

    @Column(name = "bank_account_holder", length = 120)
    private String bankAccountHolder;

    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc;

    /** APPROVED, PENDING, SUSPENDED, REJECTED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "APPROVED";

    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;
}
