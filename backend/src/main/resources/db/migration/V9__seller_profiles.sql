-- ══════════════════════════════════════════════════════════════════
-- V9__seller_profiles.sql — Flipkart-style Become a Seller onboarding
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seller_profiles (
    id                  BIGSERIAL    PRIMARY KEY,
    user_id             BIGINT       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    store_name          VARCHAR(150) NOT NULL,
    business_type       VARCHAR(60)  NOT NULL DEFAULT 'INDIVIDUAL',
    gstin               VARCHAR(20),
    phone               VARCHAR(20)  NOT NULL,
    pickup_address      VARCHAR(500) NOT NULL,
    city                VARCHAR(100) NOT NULL,
    state               VARCHAR(100) NOT NULL,
    pincode             VARCHAR(10)  NOT NULL,
    bank_account_holder VARCHAR(120),
    bank_ifsc           VARCHAR(20),
    status              VARCHAR(20)  NOT NULL DEFAULT 'APPROVED',
    admin_note          TEXT,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON seller_profiles(status);

ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES seller_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
