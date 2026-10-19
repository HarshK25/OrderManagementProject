package com.ordermanagement.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Shipping details captured at checkout.
 * These are snapshotted into the Order — changes to the user's profile
 * after placing the order do not affect the shipping address.
 */
@Data
public class PlaceOrderRequest {

    @NotBlank(message = "Recipient name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    private String shippingName;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
    private String shippingPhone;

    @NotBlank(message = "Address is required")
    @Size(max = 500, message = "Address must be at most 500 characters")
    private String shippingAddress;

    @NotBlank(message = "City is required")
    @Size(max = 100, message = "City must be at most 100 characters")
    private String shippingCity;

    @NotBlank(message = "State is required")
    @Size(max = 100, message = "State must be at most 100 characters")
    private String shippingState;

    @NotBlank(message = "Pincode is required")
    @Pattern(regexp = "^[1-9]\\d{5}$", message = "Enter a valid 6-digit Indian pincode")
    private String shippingPincode;
}
