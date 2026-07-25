-- ============================================================
-- Migration 003: Products / Inventory Module
-- Creates: taxes, brands, product_categories, products
-- ============================================================

-- Taxes
CREATE TABLE IF NOT EXISTS taxes (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL,
    abbreviation         VARCHAR(20)  NOT NULL,
    rate                 DECIMAL(5,2) NOT NULL,
    tax_type             VARCHAR(20)  DEFAULT 'regular', -- regular, compound
    applies_to_sales     BOOLEAN      DEFAULT false,
    applies_to_purchases BOOLEAN      DEFAULT false,
    is_active            BOOLEAN      DEFAULT true
);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Product Categories (supports hierarchy)
CREATE TABLE IF NOT EXISTS product_categories (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(255) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES product_categories(id),
    is_active BOOLEAN DEFAULT true
);

-- Products
-- Note: expense_account_id is nullable here; will be enforced once COA module is live
CREATE TABLE IF NOT EXISTS products (
    id                           SERIAL PRIMARY KEY,
    code                         VARCHAR(50)   UNIQUE NOT NULL,
    name                         VARCHAR(255)  NOT NULL,
    type                         VARCHAR(20)   NOT NULL DEFAULT 'product', -- product, service, product_variant
    parent_product_id            INTEGER REFERENCES products(id),
    category_id                  INTEGER REFERENCES product_categories(id),
    brand_id                     INTEGER REFERENCES brands(id),
    unit_of_measurement          VARCHAR(20)   NOT NULL DEFAULT 'PCS',
    fractional_units             BOOLEAN       DEFAULT false,
    -- Inventory toggles (immutable after first save per FR-INV-PROD-02)
    track_inventory              BOOLEAN       DEFAULT false,
    manage_batch                 BOOLEAN       DEFAULT false,
    manage_serial                BOOLEAN       DEFAULT false,
    has_packaging                BOOLEAN       DEFAULT false,
    is_assembled                 BOOLEAN       DEFAULT false,
    -- COA links (optional until COA module is implemented)
    inventory_account_id         INTEGER REFERENCES chart_of_accounts(id),
    expense_account_id           INTEGER REFERENCES chart_of_accounts(id),
    discount_received_account_id INTEGER REFERENCES chart_of_accounts(id),
    -- Purchase settings (FR-INV-PROD-03)
    is_purchased                 BOOLEAN       DEFAULT false,
    purchase_price               DECIMAL(15,2),
    purchase_tax_id              INTEGER REFERENCES taxes(id),
    manage_purchase_tax          BOOLEAN       DEFAULT false,
    -- Sale settings (FR-INV-PROD-04)
    is_sold                      BOOLEAN       DEFAULT false,
    sale_price                   DECIMAL(15,2),
    sales_account_id             INTEGER REFERENCES chart_of_accounts(id),
    mrp                          DECIMAL(15,2),
    sales_return_account_id      INTEGER REFERENCES chart_of_accounts(id),
    mrp_exclusive_of_tax         BOOLEAN       DEFAULT false,
    dont_allow_public            BOOLEAN       DEFAULT false,
    -- Status
    is_active                    BOOLEAN       DEFAULT true,
    created_at                   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Product number series  →  P-000001, P-000002, …
INSERT INTO number_series (name, prefix, next_number, padding)
VALUES ('Products', 'P-', 1, 6)
ON CONFLICT DO NOTHING;

-- Seed taxes
INSERT INTO taxes (name, abbreviation, rate, tax_type, applies_to_sales, applies_to_purchases) VALUES
    ('No Tax',               'NONE',   0.00, 'regular', true,  true),
    ('GST 5%',               'GST5',   5.00, 'regular', true,  true),
    ('GST 10%',              'GST10', 10.00, 'regular', true,  true),
    ('GST 15%',              'GST15', 15.00, 'regular', true,  true),
    ('GST 17%',              'GST17', 17.00, 'regular', true,  true),
    ('Sales Tax 3%',         'ST3',    3.00, 'regular', true,  false),
    ('Withholding Tax 4.5%', 'WHT',    4.50, 'regular', false, true)
ON CONFLICT DO NOTHING;

-- Seed brands
INSERT INTO brands (name) VALUES
    ('Generic'), ('Local Brand'), ('Imported')
ON CONFLICT DO NOTHING;

-- Seed product categories
INSERT INTO product_categories (name) VALUES
    ('General'),
    ('Electronics'),
    ('Clothing'),
    ('Food & Beverage'),
    ('Services'),
    ('Raw Materials'),
    ('Finished Goods')
ON CONFLICT DO NOTHING;
