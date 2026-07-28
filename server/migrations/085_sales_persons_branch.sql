-- The Sales Persons list page has a "Branch" column with no field anywhere
-- to actually set it.
ALTER TABLE sales_persons ADD COLUMN IF NOT EXISTS branch_name TEXT;
