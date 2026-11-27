package com.ordermanagement.seller.repository;

import com.ordermanagement.seller.entity.SellerProfile;
import com.ordermanagement.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SellerProfileRepository extends JpaRepository<SellerProfile, Long> {

    Optional<SellerProfile> findByUser(User user);

    boolean existsByUser(User user);

    @Query("SELECT s FROM SellerProfile s JOIN FETCH s.user ORDER BY s.createdAt DESC")
    List<SellerProfile> findAllWithUser();
}
