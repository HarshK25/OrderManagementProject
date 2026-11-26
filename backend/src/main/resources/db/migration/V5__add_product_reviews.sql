-- ============================================================
-- V5: Product Reviews & Ratings
-- ============================================================

CREATE TABLE product_reviews (
    id           BIGSERIAL PRIMARY KEY,
    product_id   BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id      BIGINT      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    order_id     BIGINT      NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title        VARCHAR(150),
    body         TEXT,
    created_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
    -- One review per user per product (a user who bought the same product twice still gets one review)
    CONSTRAINT uq_review_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX idx_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_reviews_user_id    ON product_reviews(user_id);

