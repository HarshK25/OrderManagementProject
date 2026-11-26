-- ============================================================
-- V4: Return & Refund Workflow
-- Adds new order statuses and the return_requests table
-- ============================================================

-- PostgreSQL: extend the varchar(30) column; no enum type change needed
-- because OrderStatus is stored as VARCHAR (EnumType.STRING)

-- Return requests table
CREATE TABLE return_requests (
    id               BIGSERIAL PRIMARY KEY,
    order_id         BIGINT      NOT NULL REFERENCES orders(id),
    reason           TEXT        NOT NULL,
    item_condition   VARCHAR(50) NOT NULL,   -- UNOPENED | DAMAGED | WRONG_ITEM | OTHER
    admin_note       TEXT,
    razorpay_refund_id VARCHAR(100),         -- filled after Razorpay refund call
    refund_amount    NUMERIC(12, 2),         -- amount refunded (INR)
    created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_return_order UNIQUE (order_id)  -- max one return per order
);

CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);

