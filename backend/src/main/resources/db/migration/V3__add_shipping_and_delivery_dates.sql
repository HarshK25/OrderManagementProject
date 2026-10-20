-- V3: Add estimated shipping and delivery dates, plus actual shipped and delivered timestamps

ALTER TABLE orders
    ADD COLUMN estimated_ship_date DATE,
    ADD COLUMN estimated_delivery_date DATE,
    ADD COLUMN shipped_at TIMESTAMP,
    ADD COLUMN delivered_at TIMESTAMP;

-- Backfill existing orders with default estimates based on creation time
UPDATE orders
SET estimated_ship_date = (created_at + INTERVAL '1 day')::date,
    estimated_delivery_date = (created_at + INTERVAL '4 days')::date
WHERE estimated_delivery_date IS NULL;
