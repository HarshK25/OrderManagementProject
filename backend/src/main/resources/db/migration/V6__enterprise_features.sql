-- ══════════════════════════════════════════════════════════════════
-- V6__enterprise_features.sql
-- Additive migration: Coupons, Wishlist, Address Book, Notifications,
-- Audit Logs, Payment Methods / COD, Shipment Tracking & Order Coupons
-- ══════════════════════════════════════════════════════════════════

-- ── Extend orders table ───────────────────────────────────────────
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(30)   NOT NULL DEFAULT 'ONLINE',
    ADD COLUMN IF NOT EXISTS coupon_code      VARCHAR(50),
    ADD COLUMN IF NOT EXISTS coupon_discount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tracking_number  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS carrier          VARCHAR(100);

-- ── Extend payments table ─────────────────────────────────────────
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(30)   NOT NULL DEFAULT 'ONLINE';

-- ── Coupons ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
    id               BIGSERIAL      PRIMARY KEY,
    code             VARCHAR(50)    NOT NULL UNIQUE,
    discount_type    VARCHAR(20)    NOT NULL DEFAULT 'PERCENTAGE',
    discount_value   NUMERIC(12,2)  NOT NULL,
    min_order_amount NUMERIC(12,2)  NOT NULL DEFAULT 0,
    max_discount     NUMERIC(12,2),
    usage_limit      INTEGER,
    used_count       INTEGER        NOT NULL DEFAULT 0,
    expires_at       TIMESTAMP,
    active           BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP      NOT NULL DEFAULT NOW()
);

INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, active)
VALUES
    ('WELCOME10', 'PERCENTAGE', 10.00, 500.00, 500.00, 1000, TRUE),
    ('FLAT200',   'FIXED',      200.00, 1000.00, NULL,  500, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ── Wishlist ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist_items (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist_items(user_id);

-- ── User Addresses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_addresses (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label          VARCHAR(50)  NOT NULL DEFAULT 'Home',
    recipient_name VARCHAR(100) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    address_line   VARCHAR(500) NOT NULL,
    city           VARCHAR(100) NOT NULL,
    state          VARCHAR(100) NOT NULL,
    pincode        VARCHAR(10)  NOT NULL,
    is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

-- ── In-App Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    message    VARCHAR(1000) NOT NULL,
    type       VARCHAR(40)  NOT NULL DEFAULT 'INFO',
    read_flag  BOOLEAN      NOT NULL DEFAULT FALSE,
    link       VARCHAR(255),
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

-- ── Audit Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL     PRIMARY KEY,
    actor_email VARCHAR(255)  NOT NULL,
    action      VARCHAR(100)  NOT NULL,
    entity_type VARCHAR(60)   NOT NULL,
    entity_id   VARCHAR(100),
    details     VARCHAR(1000),
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
