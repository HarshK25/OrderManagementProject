-- ══════════════════════════════════════════════════════════════════
-- V2__init_schema.sql  — Full application schema
-- ══════════════════════════════════════════════════════════════════
-- Design notes:
--  • BigSerial for surrogate PKs (auto-increment BIGINT)
--  • NUMERIC(12,2) for all money columns
--  • ON DELETE CASCADE where a child row is meaningless without parent
--  • ON DELETE SET NULL where the FK is informational (e.g. product on order_item)
--  • Indexes on every FK column plus common filter/sort columns
-- ══════════════════════════════════════════════════════════════════

-- ── Users ─────────────────────────────────────────────────────────
CREATE TABLE users (
    id           BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER',
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Refresh Tokens ────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP    NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ── Categories ────────────────────────────────────────────────────
CREATE TABLE categories (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Products ──────────────────────────────────────────────────────
CREATE TABLE products (
    id               BIGSERIAL      PRIMARY KEY,
    name             VARCHAR(255)   NOT NULL,
    description      TEXT,
    category_id      BIGINT         REFERENCES categories(id) ON DELETE SET NULL,
    price            NUMERIC(12,2)  NOT NULL,
    discount_percent NUMERIC(5,2)   NOT NULL DEFAULT 0,
    stock            INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url        VARCHAR(500),
    active           BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP      NOT NULL DEFAULT NOW()
);
-- Indexes for public browsing: filter by category, price range; sort by price/date
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_active       ON products(active);
CREATE INDEX idx_products_price        ON products(price);
CREATE INDEX idx_products_created_at   ON products(created_at DESC);
-- Full-text search index on name + description
CREATE INDEX idx_products_name_gin ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ── Carts ─────────────────────────────────────────────────────────
CREATE TABLE carts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Cart Items ────────────────────────────────────────────────────
CREATE TABLE cart_items (
    id         BIGSERIAL PRIMARY KEY,
    cart_id    BIGINT    NOT NULL REFERENCES carts(id)    ON DELETE CASCADE,
    product_id BIGINT    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity   INTEGER   NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, product_id)
);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);

-- ── Orders ────────────────────────────────────────────────────────
CREATE TABLE orders (
    id               BIGSERIAL      PRIMARY KEY,
    order_number     VARCHAR(50)    NOT NULL UNIQUE,
    user_id          BIGINT         NOT NULL REFERENCES users(id),
    status           VARCHAR(30)    NOT NULL,
    subtotal         NUMERIC(12,2)  NOT NULL,
    discount_total   NUMERIC(12,2)  NOT NULL DEFAULT 0,
    total            NUMERIC(12,2)  NOT NULL,
    shipping_name    VARCHAR(100)   NOT NULL,
    shipping_phone   VARCHAR(20)    NOT NULL,
    shipping_address VARCHAR(500)   NOT NULL,
    shipping_city    VARCHAR(100)   NOT NULL,
    shipping_state   VARCHAR(100)   NOT NULL,
    shipping_pincode VARCHAR(10)    NOT NULL,
    expires_at       TIMESTAMP,
    created_at       TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP      NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user_id    ON orders(user_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ── Order Items (price + name snapshots — never change after creation) ──
CREATE TABLE order_items (
    id           BIGSERIAL      PRIMARY KEY,
    order_id     BIGINT         NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    product_id   BIGINT         REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255)   NOT NULL,
    unit_price   NUMERIC(12,2)  NOT NULL,
    quantity     INTEGER        NOT NULL,
    line_total   NUMERIC(12,2)  NOT NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ── Order Status History ──────────────────────────────────────────
CREATE TABLE order_status_history (
    id          BIGSERIAL   PRIMARY KEY,
    order_id    BIGINT      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status   VARCHAR(30) NOT NULL,
    note        VARCHAR(500),
    changed_by  VARCHAR(100),
    changed_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- ── Payments ──────────────────────────────────────────────────────
CREATE TABLE payments (
    id                  BIGSERIAL     PRIMARY KEY,
    order_id            BIGINT        NOT NULL REFERENCES orders(id),
    razorpay_order_id   VARCHAR(100)  NOT NULL,
    razorpay_payment_id VARCHAR(100)  UNIQUE,
    amount              NUMERIC(12,2) NOT NULL,
    status              VARCHAR(30)   NOT NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_order_id ON payments(order_id);

-- ── Processed Events (email idempotency guard) ────────────────────
CREATE TABLE processed_events (
    event_id     VARCHAR(100) PRIMARY KEY,
    processed_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
