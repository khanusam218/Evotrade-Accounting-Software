# Requirements Specification: Splendid Accounts Clone

## 1. Introduction
This document defines the functional requirements for cloning the accounting software "Splendid Accounts". The system covers CRM, Sales, Purchases, POS, Accounts, Inventory, Manufacturing, Reports, Dashboard, Payroll, User Management, and various configuration masters.

## 2. Module Requirements Summary

The following table lists all modules and the number of functional requirements identified.

| Module | Requirements |
|--------|--------------|
| CRM (Tickets, Leads, Events, Calls, Tags, Statuses, Industries, Sources, Event Types/Statuses) | ~44 |
| Sales (Quotation, Order, Delivery, Invoice, Recurring Invoice, Return, Receive Payment, Refund, Settlement) | 150 |
| Purchases (Order, Good Receiving, Invoice, Import Invoice, Return, Make Payment, Refund, Settlement) | 137 |
| POS (Checkout Counter, Check‑in, Delivery Counter, Offline, Barcode/QR, Daily Summary) | 95 |
| Accounts (Expenses, Journal Entry, Chart of Accounts, Bank Account, Bank Deposit, Credit Note, Debit Note, Funds Transfer, Other Collections, Other Payments, Instruments, Other Contact Settlement) | 235 |
| Inventory (Stock Movement, Stock Adjustment, Scheduled Valuation, Product Master, Adjustment Types, Consignments) | ~99 |
| Manufacturing (Job Orders, Disassembling) | 38 |
| Reports | 9 |
| Refer And Earn | 14 |
| Dashboard | 22 |
| Payroll (Employees, Departments, Designations, Projects) | 32 |
| Sales Persons | 14 |
| Users & Roles | 15 |
| Other Contacts | 8 |
| Prospects | 9 |
| Couriers | 7 |
| Customer Portal | 13 |
| Setup / Lookups (Categories, Brands, Taxes, Warehouses, Custom Fields, Multiple Price Levels, etc.) | ~52 |
| **Total** | **~1029** |

## 3. Detailed Functional Requirements (Sample)

Due to length, only representative requirements are shown. Full list provided in Excel traceability matrix.

### 3.1 CRM – Tickets
- FR-CRM-TK-01: Multi‑filter ticket list (Number, Date, Title, Contact, etc.)
- FR-CRM-TK-02: Auto‑generated ticket number `T-XXXXX`
- FR-CRM-TK-03: Type‑ahead for Contact, Project, Tag, Assigned To
- FR-CRM-TK-04: Drag‑and‑drop attachments
- FR-CRM-TK-05: Status workflow (Open → In Progress → Resolved → Closed)

### 3.2 Sales – Quotations
- FR-SALES-QT-01: Filters by Number, Date, Customer, Reference, Expiry Date, Amounts, Status
- FR-SALES-QT-02: Bulk approve selected quotations
- FR-SALES-QT-03: Export to Excel
- FR-SALES-QT-04: Auto‑number `SQ-XXXXXX`
- FR-SALES-QT-05: Line items with product search, quantity, price, discount, amount auto‑calc
- FR-SALES-QT-06: Barcode scanning for quick product addition
- FR-SALES-QT-07: Convert to Sales Order or Invoice

### 3.3 Purchases – Purchase Orders
- FR-PUR-PO-01: Filters by Number, Date, Vendor, Reference, Receipt Date, Amounts, Status
- FR-PUR-PO-02: Auto‑number `PO-XXXXXX`
- FR-PO-03: Link to Good Receiving and Invoice
- FR-PO-04: Track received quantity, partial receipts allowed

### 3.4 POS – Checkout Counter
- FR-POS-CC-01: List checkout counters (Name, Cash Account, Warehouse, Status)
- FR-POS-CC-02: Add counter with Name, Warehouse, Cash Account, Invoice Series, Return Series
- FR-POS-CC-03: Check‑in/check‑out with cash reconciliation
- FR-POS-CC-04: Offline mode with local storage and sync

### 3.5 Accounts – Chart of Accounts
- FR-ACC-COA-01: Hierarchical grouping by Asset, Liability, Equity, Revenue, Expense
- FR-ACC-COA-02: Account code format `XXX-XXXXX`
- FR-ACC-COA-03: Add/edit account with Parent Account, Account Group (Transactional/Control), Code, Name
- FR-ACC-COA-04: Opening balances via Journal Entry

### 3.6 Inventory – Product Master
- FR-INV-PROD-01: Product types: Product, Service, Product Variant
- FR-INV-PROD-02: Track Inventory, Batch, Serial, Packaging, Assemble toggles (immutable after save)
- FR-INV-PROD-03: Purchase settings (Purchase Price, Tax, Discount Account)
- FR-INV-PROD-04: Sale settings (Sale Price, Sales Account, MRP, Sales Return Account)
- FR-INV-PROD-05: Opening stock via Stock Adjustment (type “Openings”)

### 3.7 Manufacturing – Job Orders
- FR-MFG-JO-01: Auto‑number `JO-XXXXXX`
- FR-MFG-JO-02: Input (components) and Output (finished goods) tables
- FR-MFG-JO-03: Completion decreases component stock, increases finished good stock, posts journal entry
- FR-MFG-JO-04: Partial completion allowed

### 3.8 Reports
- FR-REP-01: Reports categorised by module (Sales, Purchases, Inventory, Accounts, etc.)
- FR-REP-02: Date range and entity filters
- FR-REP-03: Export to Excel/PDF and Print

### 3.9 Dashboard
- FR-DASH-01: KPIs: Today/Yesterday/This Month/Last Month/This Year/Last Year Sales
- FR-DASH-02: Revenue vs Expense chart, Profit & Loss line chart
- FR-DASH-03: Account Receivable Aging, Top Products, Top Customers, Cash & Bank balances, Low Inventory alerts

### 3.10 Payroll
- FR-PAY-01: Employees master (Code, Name, Department, Designation, Joining Date, Salary, NTN, CNIC, attachments)
- FR-PAY-02: Departments (Name, Manager)
- FR-PAY-03: Designations (Name, optional Department)
- FR-PAY-04: Projects (Name, Customer, Start/End Date, Budget, Status, Assigned Employees)

### 3.11 Users & Roles
- FR-USER-01: Predefined roles (Company Admin, Sales Manager, Purchase Assistant, etc.)
- FR-USER-02: Invite users via email, assign one or more roles
- FR-USER-03: Role permissions: full CRUD+approve for managers; draft‑only for assistants; view only for report viewers

### 3.12 Configuration Masters
- Customer Categories, Vendor Categories, Product Categories, Other Contact Categories, Brands: simple Name, optional Description, active flag.
- Product Categories support hierarchy (Parent Category).
- Taxes: Name, Abbreviation, Rate (%), applies to sales and/or purchases.
- Warehouses: Name, address, phone, default flag.
- Adjustment Types: Name, linked COA Account, Add/Subtract direction.
- Consignments: consignment in/out, track stock separately, settle via invoice.
- Custom Fields: define additional fields on Product/Customer/Vendor/Employee/Other Contact with Type (Text, Number, Date, Dropdown, etc.).
- Multiple Price Levels: define special prices for customer categories over date range.
- Ticket Tags, Ticket Statuses, Industries, Lead Sources, Lead Statuses, Event Types, Event Statuses: simple or with colour/abbreviation/default flag.

## 4. Database Schema (excerpt – full SQL provided in separate file)
```sql
-- Core tables
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    print_name VARCHAR(255),
    email_1 VARCHAR(255),
    phone_1 VARCHAR(50),
    opening_balance DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    default_discount_percent DECIMAL(5,2) DEFAULT 0,
    withholding_tax_percent DECIMAL(5,2) DEFAULT 0,
    category_id INTEGER REFERENCES customer_categories(id),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255),
    type VARCHAR(20), -- product, service, product_variant
    unit_of_measurement VARCHAR(20),
    track_inventory BOOLEAN DEFAULT false,
    inventory_account_id INTEGER REFERENCES chart_of_accounts(id),
    expense_account_id INTEGER REFERENCES chart_of_accounts(id),
    purchase_price DECIMAL(15,2),
    sale_price DECIMAL(15,2),
    ...
);
-- Additional tables: sales_quotations, sales_orders, purchase_invoices, pos_checkout_counters, etc.