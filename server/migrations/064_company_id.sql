-- ============================================================
-- Migration 064: Multi-company data isolation
-- Strategy: Add company_id to every data table + PostgreSQL RLS
-- Existing data → company_id = 'evotrade' (via DEFAULT)
-- Tables that don't exist yet are silently skipped.
-- ============================================================

-- Helper: returns the current company from session variable (defaults to 'evotrade')
CREATE OR REPLACE FUNCTION current_company_id() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.company_id', true), ''), 'evotrade')
$$;

-- ── Step 1: Add company_id column to every data table ────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    -- Masters
    'customers','customer_categories','vendors','vendor_categories',
    'products','product_categories','brands','taxes',
    'chart_of_accounts','number_series','company_settings','product_stock',
    -- Accounts
    'journal_entries','journal_entry_lines',
    'bank_accounts','expenses','expense_lines','fund_transfers',
    'bank_deposits','bank_deposit_lines',
    'credit_notes','credit_note_allocations',
    'debit_notes','debit_note_allocations',
    'other_collections','other_collection_adjustments',
    'other_payments','other_payment_adjustments',
    'payment_instruments','instruments',
    'other_contact_settlements','ocs_receivable_lines','ocs_received_lines',
    -- Sales
    'sales_quotations','sales_quotation_lines',
    'sales_orders','sales_order_lines',
    'sales_invoices','sales_invoice_lines',
    'receive_payments','rp_adjustments','rp_allocations','rp_instruments',
    'sales_returns','sales_return_lines',
    'sales_refunds','sales_refund_instruments',
    'sales_settlements','sales_settlement_lines',
    'recurring_invoices','recurring_invoice_lines',
    'sales_deliveries','sales_delivery_lines',
    -- Purchases
    'purchase_quotations','purchase_quotation_lines',
    'purchase_orders','purchase_order_lines',
    'purchase_invoices','purchase_invoice_lines',
    'make_payments','make_payment_instruments',
    'purchase_returns','purchase_return_lines',
    'purchase_refunds','purchase_refund_instruments',
    'purchase_settlements','purchase_settlement_lines',
    'purchase_receipts','purchase_receipt_lines',
    'import_invoices','import_invoice_lines','import_invoice_expenses',
    -- Inventory
    'warehouses','stock_adjustments','stock_adjustment_lines',
    'stock_movements','stock_movement_lines','scheduled_valuations',
    -- CRM
    'crm_leads','crm_events','crm_tickets','crm_calls','crm_activities',
    'other_contacts','prospects',
    -- Setup / HR
    'couriers','sales_persons','departments','designations','employees',
    'projects','adjustment_types','barcode_templates',
    -- Manufacturing
    'bill_of_materials','bom_components','work_orders',
    'disassembly_orders','disassembly_output_lines',
    -- POS
    'pos_counters','pos_sessions','pos_transactions','pos_transaction_lines',
    'pos_delivery_counters','pos_delivery_counter_categories'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT current_company_id()',
          tbl
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ADD company_id skipped for %: %', tbl, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END IF;
  END LOOP;
END $$;

-- ── Step 2: Fix UNIQUE constraints to be per-company ─────────

-- Simple name/code constraints (one-liners)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('number_series',       'number_series_name_key',           'number_series_name_company_key',           'name'),
    ('customer_categories', 'customer_categories_name_key',     'customer_categories_name_company_key',     'name'),
    ('vendor_categories',   'vendor_categories_name_key',       'vendor_categories_name_company_key',       'name'),
    ('product_categories',  'product_categories_name_key',      'product_categories_name_company_key',      'name'),
    ('brands',              'brands_name_key',                  'brands_name_company_key',                  'name'),
    ('taxes',               'taxes_name_key',                   'taxes_name_company_key',                   'name'),
    ('customers',           'customers_code_key',               'customers_code_company_key',               'code'),
    ('vendors',             'vendors_code_key',                 'vendors_code_company_key',                 'code'),
    ('products',            'products_code_key',                'products_code_company_key',                'code'),
    ('chart_of_accounts',   'chart_of_accounts_code_key',       'chart_of_accounts_code_company_key',       'code'),
    ('warehouses',          'warehouses_name_key',              'warehouses_name_company_key',              'name')
  ) AS t(tbl, old_con, new_con, col)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = r.tbl) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.old_con);
      EXCEPTION WHEN OTHERS THEN NULL; END;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.new_con) THEN
        BEGIN
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (%I, company_id)',
            r.tbl, r.new_con, r.col
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'UNIQUE constraint % skipped: %', r.new_con, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Transaction document numbers (unique per company)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'journal_entries','bank_deposits','credit_notes','debit_notes',
    'other_collections','other_payments','other_contact_settlements',
    'sales_quotations','sales_orders','sales_invoices','receive_payments',
    'sales_returns','sales_refunds','sales_settlements','recurring_invoices',
    'sales_deliveries','purchase_quotations','purchase_orders','purchase_invoices',
    'make_payments','purchase_returns','purchase_refunds','purchase_settlements',
    'purchase_receipts','import_invoices','stock_adjustments','stock_movements',
    'bill_of_materials','work_orders','disassembly_orders'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_number_key');
      EXCEPTION WHEN OTHERS THEN NULL; END;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = tbl || '_number_company_key') THEN
        BEGIN
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (number, company_id)',
            tbl, tbl || '_number_company_key'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'UNIQUE number constraint skipped for %: %', tbl, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ── Step 3: Row Level Security on all data tables ─────────────

CREATE OR REPLACE FUNCTION setup_company_rls(tbl TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',  tbl);
  EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', tbl);
  EXECUTE format(
    'CREATE POLICY company_isolation ON %I '
    'USING (company_id = current_company_id()) '
    'WITH CHECK (company_id = current_company_id())',
    tbl
  );
END $$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    -- Masters
    'customers','customer_categories','vendors','vendor_categories',
    'products','product_categories','brands','taxes',
    'chart_of_accounts','number_series','company_settings','product_stock',
    -- Accounts
    'journal_entries','journal_entry_lines',
    'bank_accounts','expenses','expense_lines','fund_transfers',
    'bank_deposits','bank_deposit_lines',
    'credit_notes','credit_note_allocations',
    'debit_notes','debit_note_allocations',
    'other_collections','other_collection_adjustments',
    'other_payments','other_payment_adjustments',
    'payment_instruments','instruments',
    'other_contact_settlements','ocs_receivable_lines','ocs_received_lines',
    -- Sales
    'sales_quotations','sales_quotation_lines',
    'sales_orders','sales_order_lines',
    'sales_invoices','sales_invoice_lines',
    'receive_payments','rp_adjustments','rp_allocations','rp_instruments',
    'sales_returns','sales_return_lines',
    'sales_refunds','sales_refund_instruments',
    'sales_settlements','sales_settlement_lines',
    'recurring_invoices','recurring_invoice_lines',
    'sales_deliveries','sales_delivery_lines',
    -- Purchases
    'purchase_quotations','purchase_quotation_lines',
    'purchase_orders','purchase_order_lines',
    'purchase_invoices','purchase_invoice_lines',
    'make_payments','make_payment_instruments',
    'purchase_returns','purchase_return_lines',
    'purchase_refunds','purchase_refund_instruments',
    'purchase_settlements','purchase_settlement_lines',
    'purchase_receipts','purchase_receipt_lines',
    'import_invoices','import_invoice_lines','import_invoice_expenses',
    -- Inventory
    'warehouses','stock_adjustments','stock_adjustment_lines',
    'stock_movements','stock_movement_lines','scheduled_valuations',
    -- CRM
    'crm_leads','crm_events','crm_tickets','crm_calls','crm_activities',
    'other_contacts','prospects',
    -- Setup / HR
    'couriers','sales_persons','departments','designations','employees',
    'projects','adjustment_types','barcode_templates',
    -- Manufacturing
    'bill_of_materials','bom_components','work_orders',
    'disassembly_orders','disassembly_output_lines',
    -- POS
    'pos_counters','pos_sessions','pos_transactions','pos_transaction_lines',
    'pos_delivery_counters','pos_delivery_counter_categories'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      BEGIN
        PERFORM setup_company_rls(tbl);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'setup_company_rls skipped for %: %', tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
