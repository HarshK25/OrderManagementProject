-- ══════════════════════════════════════════════════════════════════
-- V7__concurrency_control.sql
-- 1. Optimistic locking version column on products
-- 2. Lock-free PostgreSQL sequence for collision-safe order numbers
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000 INCREMENT BY 1;
