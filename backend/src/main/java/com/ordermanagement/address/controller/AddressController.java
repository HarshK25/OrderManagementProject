package com.ordermanagement.address.controller;

import com.ordermanagement.address.entity.UserAddress;
import com.ordermanagement.address.repository.UserAddressRepository;
import com.ordermanagement.common.exception.ResourceNotFoundException;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
@Tag(name = "Addresses", description = "Customer address book management")
@SecurityRequirement(name = "bearerAuth")
public class AddressController {

    private final UserAddressRepository addressRepository;

    @Data
    public static class AddressDto {
        private Long id;
        private String label;
        @NotBlank private String recipientName;
        @NotBlank @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
        private String phone;
        @NotBlank private String addressLine;
        @NotBlank private String city;
        @NotBlank private String state;
        @NotBlank @Pattern(regexp = "^[1-9]\\d{5}$", message = "Enter a valid 6-digit pincode")
        private String pincode;
        private boolean defaultAddress;

        public static AddressDto from(UserAddress a) {
            AddressDto dto = new AddressDto();
            dto.setId(a.getId());
            dto.setLabel(a.getLabel());
            dto.setRecipientName(a.getRecipientName());
            dto.setPhone(a.getPhone());
            dto.setAddressLine(a.getAddressLine());
            dto.setCity(a.getCity());
            dto.setState(a.getState());
            dto.setPincode(a.getPincode());
            dto.setDefaultAddress(a.isDefaultAddress());
            return dto;
        }
    }

    @GetMapping
    @Operation(summary = "List saved addresses for the current user")
    public List<AddressDto> list(@AuthenticationPrincipal User user) {
        return addressRepository.findByUserIdOrderByDefaultAddressDescCreatedAtDesc(user.getId())
                .stream().map(AddressDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @Operation(summary = "Add a new shipping address")
    public AddressDto create(@AuthenticationPrincipal User user,
                             @Valid @RequestBody AddressDto req) {
        if (req.isDefaultAddress()) {
            clearDefaults(user.getId());
        }
        UserAddress addr = UserAddress.builder()
                .user(user)
                .label(req.getLabel() != null && !req.getLabel().isBlank() ? req.getLabel() : "Home")
                .recipientName(req.getRecipientName())
                .phone(req.getPhone())
                .addressLine(req.getAddressLine())
                .city(req.getCity())
                .state(req.getState())
                .pincode(req.getPincode())
                .defaultAddress(req.isDefaultAddress())
                .build();
        return AddressDto.from(addressRepository.save(addr));
    }

    @PutMapping("/{id}")
    @Transactional
    @Operation(summary = "Update an existing shipping address")
    public AddressDto update(@AuthenticationPrincipal User user,
                             @PathVariable Long id,
                             @Valid @RequestBody AddressDto req) {
        UserAddress addr = addressRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address", id));
        if (req.isDefaultAddress()) {
            clearDefaults(user.getId());
        }
        addr.setLabel(req.getLabel() != null && !req.getLabel().isBlank() ? req.getLabel() : addr.getLabel());
        addr.setRecipientName(req.getRecipientName());
        addr.setPhone(req.getPhone());
        addr.setAddressLine(req.getAddressLine());
        addr.setCity(req.getCity());
        addr.setState(req.getState());
        addr.setPincode(req.getPincode());
        addr.setDefaultAddress(req.isDefaultAddress());
        return AddressDto.from(addressRepository.save(addr));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @Operation(summary = "Delete a saved address")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        UserAddress addr = addressRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address", id));
        addressRepository.delete(addr);
    }

    private void clearDefaults(Long userId) {
        addressRepository.findByUserIdOrderByDefaultAddressDescCreatedAtDesc(userId).forEach(a -> {
            if (a.isDefaultAddress()) {
                a.setDefaultAddress(false);
                addressRepository.save(a);
            }
        });
    }
}
