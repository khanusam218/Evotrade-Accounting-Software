-- POS Delivery Counters (for phone/online order fulfillment)
CREATE TABLE IF NOT EXISTS pos_delivery_counters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  warehouse_id INTEGER REFERENCES warehouses(id),
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery counter categories (which product categories this counter handles)
CREATE TABLE IF NOT EXISTS pos_delivery_counter_categories (
  counter_id  INTEGER NOT NULL REFERENCES pos_delivery_counters(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (counter_id, category_id)
);
