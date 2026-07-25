-- ============================================
-- Splendid Accounts Clone - Database Schema
-- ============================================

-- Users & Roles
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    invitation_token VARCHAR(255),
    invitation_sent_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'invitation_pending', -- active, inactive, invitation_pending
    is_owner BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    permissions JSONB
);

CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Chart of Accounts
CREATE TABLE chart_of_accounts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    system_name VARCHAR(100),
    account_type VARCHAR(30) NOT NULL, -- asset, liability, equity, revenue, expense, contra_asset, contra_revenue
    parent_id INTEGER REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    normal_balance VARCHAR(6) NOT NULL, -- debit or credit
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE customer_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    print_name VARCHAR(255) NOT NULL,
    email_1 VARCHAR(255),
    email_2 VARCHAR(255),
    email_3 VARCHAR(255),
    phone_1 VARCHAR(50),
    phone_2 VARCHAR(50),
    phone_3 VARCHAR(50),
    longitude DECIMAL(10,7),
    latitude DECIMAL(10,7),
    opening_balance DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    default_discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_account_id INTEGER REFERENCES chart_of_accounts(id),
    withholding_tax_percent DECIMAL(5,2) DEFAULT 0,
    category_id INTEGER REFERENCES customer_categories(id),
    contact_person VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendors (similar, simplified)
CREATE TABLE vendor_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    print_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone_1 VARCHAR(50),
    category_id INTEGER REFERENCES vendor_categories(id),
    opening_balance DECIMAL(15,2) DEFAULT 0,
    credit_limit_days INTEGER DEFAULT 0,
    is_principal BOOLEAN DEFAULT false,
    contact_person VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES product_categories(id),
    image VARCHAR(255),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- product, service, product_variant
    parent_product_id INTEGER REFERENCES products(id),
    category_id INTEGER REFERENCES product_categories(id),
    brand_id INTEGER REFERENCES brands(id),
    unit_of_measurement VARCHAR(20) NOT NULL,
    fractional_units BOOLEAN DEFAULT false,
    auto_price_from_amount BOOLEAN DEFAULT false,
    auto_qty_from_amount BOOLEAN DEFAULT false,
    calculation_field BOOLEAN DEFAULT false,
    third_schedule_category BOOLEAN DEFAULT false,
    track_inventory BOOLEAN DEFAULT false,
    manage_batch BOOLEAN DEFAULT false,
    manage_serial BOOLEAN DEFAULT false,
    has_packaging BOOLEAN DEFAULT false,
    is_assembled BOOLEAN DEFAULT false,
    inventory_account_id INTEGER REFERENCES chart_of_accounts(id),
    expense_account_id INTEGER REFERENCES chart_of_accounts(id) NOT NULL, -- COGS
    discount_received_account_id INTEGER REFERENCES chart_of_accounts(id),
    is_purchased BOOLEAN DEFAULT false,
    purchase_price DECIMAL(15,2),
    purchase_tax_id INTEGER REFERENCES taxes(id),
    manage_purchase_tax BOOLEAN DEFAULT false,
    is_sold BOOLEAN DEFAULT false,
    sale_price DECIMAL(15,2),
    sales_account_id INTEGER REFERENCES chart_of_accounts(id),
    mrp DECIMAL(15,2),
    sales_return_account_id INTEGER REFERENCES chart_of_accounts(id),
    dont_allow_public BOOLEAN DEFAULT false,
    mrp_exclusive_of_tax BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Taxes
CREATE TABLE taxes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(20) DEFAULT 'regular', -- regular, compound
    applies_to_sales BOOLEAN DEFAULT false,
    applies_to_purchases BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true
);

-- Warehouses
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    address_line_1 TEXT,
    address_line_2 TEXT,
    address_line_3 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(20),
    country VARCHAR(100),
    phone VARCHAR(50),
    fax VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true
);

-- Number Series
CREATE TABLE number_series (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    prefix VARCHAR(20),
    next_number INTEGER NOT NULL DEFAULT 1,
    padding INTEGER DEFAULT 6,
    suffix VARCHAR(20)
);

-- Sales Quotations
CREATE TABLE sales_quotations (
    id SERIAL PRIMARY KEY,
    number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    date DATE NOT NULL,
    expiry_date DATE,
    reference VARCHAR(100),
    description TEXT,
    terms TEXT,
    gross_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    net_amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    converted_to_type VARCHAR(10), -- order, invoice
    converted_to_id INTEGER,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER REFERENCES sales_quotations(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity DECIMAL(12,2) NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    amount DECIMAL(15,2) GENERATED ALWAYS AS (quantity * price * (1 - discount_percent/100)) STORED
);

-- Sales Orders (similar structure)
-- Sales Invoices
-- Purchase Orders
-- Purchase Invoices
-- POS Checkout Counters, Transactions
-- Inventory Stock Movements, Adjustments
-- Manufacturing Job Orders
-- etc.

-- Additional indexes, foreign keys, constraints omitted for brevity.