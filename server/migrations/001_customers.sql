-- ============================================================
-- Migration 001: Customers Module
-- Creates: chart_of_accounts (stub), customer_categories,
--          customers, number_series (with Customer seed)
-- ============================================================

-- Chart of Accounts stub (required by customers.discount_account_id FK)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(20)  UNIQUE NOT NULL,
    name             VARCHAR(255) NOT NULL,
    system_name      VARCHAR(100),
    account_type     VARCHAR(30)  NOT NULL,
    parent_id        INTEGER REFERENCES chart_of_accounts(id),
    is_active        BOOLEAN      DEFAULT true,
    is_system        BOOLEAN      DEFAULT false,
    normal_balance   VARCHAR(6)   NOT NULL,
    opening_balance  DECIMAL(15,2) DEFAULT 0,
    current_balance  DECIMAL(15,2) DEFAULT 0,
    description      TEXT,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Customer Categories
CREATE TABLE IF NOT EXISTS customer_categories (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id                        SERIAL PRIMARY KEY,
    code                      VARCHAR(50)   UNIQUE NOT NULL,
    print_name                VARCHAR(255)  NOT NULL,
    email_1                   VARCHAR(255),
    email_2                   VARCHAR(255),
    email_3                   VARCHAR(255),
    phone_1                   VARCHAR(50),
    phone_2                   VARCHAR(50),
    phone_3                   VARCHAR(50),
    longitude                 DECIMAL(10,7),
    latitude                  DECIMAL(10,7),
    opening_balance           DECIMAL(15,2) DEFAULT 0,
    credit_limit              DECIMAL(15,2) DEFAULT 0,
    default_discount_percent  DECIMAL(5,2)  DEFAULT 0,
    discount_account_id       INTEGER REFERENCES chart_of_accounts(id),
    withholding_tax_percent   DECIMAL(5,2)  DEFAULT 0,
    category_id               INTEGER REFERENCES customer_categories(id),
    contact_person            VARCHAR(255),
    is_active                 BOOLEAN       DEFAULT true,
    profile_image             VARCHAR(255),
    created_at                TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Number Series (used for auto-code generation)
CREATE TABLE IF NOT EXISTS number_series (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    prefix      VARCHAR(20),
    next_number INTEGER      NOT NULL DEFAULT 1,
    padding     INTEGER      DEFAULT 6,
    suffix      VARCHAR(20)
);

-- Seed: customer number series  →  C-000001, C-000002, …
INSERT INTO number_series (name, prefix, next_number, padding)
VALUES ('Customers', 'C-', 1, 6)
ON CONFLICT DO NOTHING;

-- Seed: default customer categories
INSERT INTO customer_categories (name) VALUES
    ('Retail'),
    ('Wholesale'),
    ('Corporate'),
    ('Government'),
    ('Walk-in')
ON CONFLICT DO NOTHING;
