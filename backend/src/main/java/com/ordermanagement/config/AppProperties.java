package com.ordermanagement.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Binds every property under the {@code app.*} namespace from application.yml.
 * Keeps all custom configuration in one type-safe place instead of scattered @Value annotations.
 */
@Configuration
@ConfigurationProperties(prefix = "app")
@Getter
@Setter
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Payment payment = new Payment();
    private Razorpay razorpay = new Razorpay();
    private Admin admin = new Admin();
    private Cors cors = new Cors();
    private Groq groq = new Groq();

    @Getter @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenExpiryMs;
        private int refreshTokenExpiryDays;
    }

    @Getter @Setter
    public static class Payment {
        private int windowMinutes;
    }

    @Getter @Setter
    public static class Razorpay {
        private String keyId;
        private String keySecret;
    }

    @Getter @Setter
    public static class Admin {
        private String seedEmail;
        private String seedPassword;
        private String seedName;
    }

    @Getter @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:5173");
    }

    @Getter @Setter
    public static class Groq {
        private String apiKey;
        private String model = "llama-3.3-70b-versatile";
        private int maxTokens = 300;
        private double temperature = 0.7;
    }
}
