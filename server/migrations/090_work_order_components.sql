-- The Job Order form's Input (Consumption) table was pure decoration: the
-- product picker was a static, unclickable span, the quantity inputs were
-- uncontrolled (never read back into state), and creating/updating a work
-- order only ever sent {bom_id, date, planned_qty, notes} — none of the line
-- items. This table lets a work order persist an actual (possibly
-- user-edited) component list instead of always silently re-deriving it from
-- the BOM at consumption time.
CREATE TABLE IF NOT EXISTS work_order_components (
  id                    SERIAL PRIMARY KEY,
  work_order_id         INTEGER       NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  component_product_id  INTEGER       REFERENCES products(id),
  quantity              NUMERIC(18,4) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_work_order_components_wo ON work_order_components(work_order_id);

ALTER TABLE work_order_components ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT current_company_id();

SELECT setup_company_rls('work_order_components');
