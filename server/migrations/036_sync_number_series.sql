-- Sync number_series next_number to be ahead of the highest existing code
-- Prevents duplicate-code errors when number_series was seeded after records were created

-- Vendors  (V-000001)
UPDATE number_series
SET next_number = GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)) + 1
    FROM vendors WHERE code ~ '^[A-Z]+-[0-9]+$'
  ), next_number)
)
WHERE name = 'Vendors';

-- Customers  (C-000001)
UPDATE number_series
SET next_number = GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)) + 1
    FROM customers WHERE code ~ '^[A-Z]+-[0-9]+$'
  ), next_number)
)
WHERE name = 'Customers';

-- Products  (P-000001)
UPDATE number_series
SET next_number = GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)) + 1
    FROM products WHERE code ~ '^[A-Z]+-[0-9]+$'
  ), next_number)
)
WHERE name = 'Products';

-- Sales Invoices  (SI-000001)
UPDATE number_series
SET next_number = GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)) + 1
    FROM sales_invoices WHERE number ~ '^[A-Z]+-[0-9]+$'
  ), next_number)
)
WHERE name = 'Sales Invoices';

-- Purchase Invoices  (PI-000001)
UPDATE number_series
SET next_number = GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)) + 1
    FROM purchase_invoices WHERE number ~ '^[A-Z]+-[0-9]+$'
  ), next_number)
)
WHERE name = 'Purchase Invoices';
