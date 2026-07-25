-- ============================================================
-- Migration 002: Vendors Module
-- Creates: vendor_categories, vendors, number_series seed
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_categories (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS vendors (
    id                  SERIAL PRIMARY KEY,
    code                VARCHAR(50)   UNIQUE NOT NULL,
    print_name          VARCHAR(255)  NOT NULL,
    email               VARCHAR(255),
    phone_1             VARCHAR(50),
    phone_2             VARCHAR(50),
    category_id         INTEGER REFERENCES vendor_categories(id),
    opening_balance     DECIMAL(15,2) DEFAULT 0,
    credit_limit_days   INTEGER       DEFAULT 0,
    is_principal        BOOLEAN       DEFAULT false,
    contact_person      VARCHAR(255),
    address             TEXT,
    is_active           BOOLEAN       DEFAULT true,
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Seed vendor number series  →  V-000001, V-000002, …
INSERT INTO number_series (name, prefix, next_number, padding)
VALUES ('Vendors', 'V-', 1, 6)
ON CONFLICT DO NOTHING;

-- Seed default vendor categories
INSERT INTO vendor_categories (name) VALUES
    ('Supplier'),
    ('Manufacturer'),
    ('Distributor'),
    ('Service Provider'),
    ('Import')
ON CONFLICT DO NOTHING;
