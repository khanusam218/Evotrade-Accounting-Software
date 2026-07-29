require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const { general: rateLimitGeneral, authLimiter } = require('./middleware/rateLimiter');

const customersRouter          = require('./routes/customers');
const customerCategoriesRouter = require('./routes/customerCategories');
const vendorsRouter            = require('./routes/vendors');
const vendorCategoriesRouter   = require('./routes/vendorCategories');
const productsRouter           = require('./routes/products');
const productCategoriesRouter  = require('./routes/productCategories');
const brandsRouter             = require('./routes/brands');
const taxesRouter              = require('./routes/taxes');
const chartOfAccountsRouter    = require('./routes/chartOfAccounts');
const journalEntriesRouter     = require('./routes/journalEntries');
const bankAccountsRouter       = require('./routes/bankAccounts');
const expensesRouter           = require('./routes/expenses');
const fundTransfersRouter      = require('./routes/fundTransfers');
const bankDepositsRouter       = require('./routes/bankDeposits');
const creditNotesRouter        = require('./routes/creditNotes');
const debitNotesRouter         = require('./routes/debitNotes');
const otherCollectionsRouter   = require('./routes/otherCollections');
const otherPaymentsRouter      = require('./routes/otherPayments');
const instrumentsRouter              = require('./routes/instruments');
const otherContactSettlementsRouter  = require('./routes/otherContactSettlements');
const salesQuotationsRouter          = require('./routes/salesQuotations');
const salesOrdersRouter              = require('./routes/salesOrders');
const salesInvoicesRouter            = require('./routes/salesInvoices');
const receivePaymentsRouter          = require('./routes/receivePayments');
const salesReturnsRouter             = require('./routes/salesReturns');
const salesRefundsRouter             = require('./routes/salesRefunds');
const salesSettlementsRouter         = require('./routes/salesSettlements');
const recurringInvoicesRouter        = require('./routes/recurringInvoices');
const purchaseQuotationsRouter       = require('./routes/purchaseQuotations');
const purchaseOrdersRouter           = require('./routes/purchaseOrders');
const purchaseInvoicesRouter         = require('./routes/purchaseInvoices');
const makePaymentsRouter             = require('./routes/makePayments');
const purchaseReturnsRouter          = require('./routes/purchaseReturns');
const purchaseRefundsRouter          = require('./routes/purchaseRefunds');
const purchaseSettlementsRouter      = require('./routes/purchaseSettlements');
const warehousesRouter               = require('./routes/warehouses');
const stockAdjustmentsRouter         = require('./routes/stockAdjustments');
const stockMovementsRouter           = require('./routes/stockMovements');
const salesDeliveriesRouter          = require('./routes/salesDeliveries');
const purchaseReceiptsRouter         = require('./routes/purchaseReceipts');
const importInvoicesRouter           = require('./routes/importInvoices');
const companySettingsRouter          = require('./routes/companySettings');
const crmLeadsRouter                 = require('./routes/crmLeads');
const crmTicketsRouter               = require('./routes/crmTickets');
const crmEventsRouter                = require('./routes/crmEvents');
const crmCallsRouter                 = require('./routes/crmCalls');
const otherContactsRouter            = require('./routes/otherContacts');
const prospectsRouter                = require('./routes/prospects');
const couriersRouter                 = require('./routes/couriers');
const salesPersonsRouter             = require('./routes/salesPersons');
const usersRouter                    = require('./routes/users');
const departmentsRouter              = require('./routes/departments');
const designationsRouter             = require('./routes/designations');
const employeesRouter                = require('./routes/employees');
const projectsRouter                 = require('./routes/projects');
const billsOfMaterialsRouter         = require('./routes/billsOfMaterials');
const workOrdersRouter               = require('./routes/workOrders');
const disassemblyOrdersRouter        = require('./routes/disassemblyOrders');
const numberSeriesRouter             = require('./routes/numberSeries');
const posRouter                      = require('./routes/pos');
const posCountersRouter              = require('./routes/posCounters');
const posDeliveryCountersRouter      = require('./routes/posDeliveryCounters');
const adjustmentTypesRouter          = require('./routes/adjustmentTypes');
const barcodeTemplatesRouter         = require('./routes/barcodeTemplates');
const crmMastersRouter               = require('./routes/crmMasters');
const dashboardRouter                = require('./routes/dashboard');
const reportsRouter                  = require('./routes/reports');
const scheduledValuationsRouter      = require('./routes/scheduledValuations');
const stockAuditsRouter              = require('./routes/stockAudits');
const customFieldsRouter             = require('./routes/customFields');

const pool = require('./db');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimitGeneral);

app.use('/api/auth', authLimiter);
app.use((req, _res, next) => {
  if (req.path === '/api/health' || req.path.startsWith('/api/auth')) {
    const companyId = 'evotrade';
    return pool.companyAls.run({ companyId }, () => next());
  }
  authMiddleware(req, _res, () => {
    const raw = req.headers['x-company-id'] || 'evotrade';
    const companyId = raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || 'evotrade';
    pool.companyAls.run({ companyId }, () => next());
  });
});

app.use('/api/auth', authRouter);
app.use('/api/customers',           customersRouter);
app.use('/api/customer-categories', customerCategoriesRouter);
app.use('/api/vendors',             vendorsRouter);
app.use('/api/vendor-categories',   vendorCategoriesRouter);
app.use('/api/products',            productsRouter);
app.use('/api/product-categories',  productCategoriesRouter);
app.use('/api/brands',              brandsRouter);
app.use('/api/taxes',               taxesRouter);
app.use('/api/chart-of-accounts',   chartOfAccountsRouter);
app.use('/api/journal-entries',     journalEntriesRouter);
app.use('/api/bank-accounts',       bankAccountsRouter);
app.use('/api/expenses',            expensesRouter);
app.use('/api/fund-transfers',      fundTransfersRouter);
app.use('/api/bank-deposits',        bankDepositsRouter);
app.use('/api/credit-notes',         creditNotesRouter);
app.use('/api/debit-notes',          debitNotesRouter);
app.use('/api/other-collections',   otherCollectionsRouter);
app.use('/api/other-payments',      otherPaymentsRouter);
app.use('/api/instruments',                instrumentsRouter);
app.use('/api/other-contact-settlements',  otherContactSettlementsRouter);
app.use('/api/sales-quotations',           salesQuotationsRouter);
app.use('/api/sales-orders',               salesOrdersRouter);
app.use('/api/sales-invoices',             salesInvoicesRouter);
app.use('/api/receive-payments',           receivePaymentsRouter);
app.use('/api/sales-returns',              salesReturnsRouter);
app.use('/api/sales-refunds',              salesRefundsRouter);
app.use('/api/sales-settlements',          salesSettlementsRouter);
app.use('/api/recurring-invoices',         recurringInvoicesRouter);
app.use('/api/purchase-quotations',        purchaseQuotationsRouter);
app.use('/api/purchase-orders',            purchaseOrdersRouter);
app.use('/api/purchase-invoices',          purchaseInvoicesRouter);
app.use('/api/make-payments',              makePaymentsRouter);
app.use('/api/purchase-returns',           purchaseReturnsRouter);
app.use('/api/purchase-refunds',           purchaseRefundsRouter);
app.use('/api/purchase-settlements',       purchaseSettlementsRouter);
app.use('/api/warehouses',                 warehousesRouter);
app.use('/api/stock-adjustments',          stockAdjustmentsRouter);
app.use('/api/stock-movements',            stockMovementsRouter);
app.use('/api/sales-deliveries',           salesDeliveriesRouter);
app.use('/api/purchase-receipts',          purchaseReceiptsRouter);
app.use('/api/import-invoices',            importInvoicesRouter);
app.use('/api/company-settings',           companySettingsRouter);
app.use('/api/crm-leads',                  crmLeadsRouter);
app.use('/api/crm-tickets',               crmTicketsRouter);
app.use('/api/crm-events',                crmEventsRouter);
app.use('/api/crm-calls',                 crmCallsRouter);
app.use('/api/other-contacts',            otherContactsRouter);
app.use('/api/prospects',                 prospectsRouter);
app.use('/api/couriers',                  couriersRouter);
app.use('/api/sales-persons',             salesPersonsRouter);
app.use('/api/users',                     usersRouter);
app.use('/api/departments',               departmentsRouter);
app.use('/api/designations',              designationsRouter);
app.use('/api/employees',                 employeesRouter);
app.use('/api/projects',                  projectsRouter);
app.use('/api/bills-of-materials',        billsOfMaterialsRouter);
app.use('/api/work-orders',               workOrdersRouter);
app.use('/api/disassembly-orders',        disassemblyOrdersRouter);
app.use('/api/number-series',             numberSeriesRouter);
app.use('/api/pos',                       posRouter);
app.use('/api/pos-counters',              posCountersRouter);
app.use('/api/pos-delivery-counters',     posDeliveryCountersRouter);
app.use('/api/adjustment-types',          adjustmentTypesRouter);
app.use('/api/scheduled-valuations',      scheduledValuationsRouter);
app.use('/api/stock-audits',              stockAuditsRouter);
app.use('/api/barcode-templates',         barcodeTemplatesRouter);
app.use('/api/crm-masters',               crmMastersRouter);
app.use('/api/dashboard',                 dashboardRouter);
app.use('/api/reports',                   reportsRouter);
app.use('/api/custom-fields',             customFieldsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Postgres error codes that reflect a bad request (client-fixable), not a server bug —
// surfaced with a specific message instead of the generic 500 fallback below.
function pgFriendlyMessage(err) {
  switch (err.code) {
    case '23505': { // unique_violation
      const col = /Key \(([^)=]+)\)/.exec(err.detail || '')?.[1];
      return col ? `A record with this ${col.split(',')[0].trim()} already exists.` : 'This record already exists.';
    }
    case '23503': // foreign_key_violation
      return 'This references a record that does not exist or is not accessible.';
    case '23502': // not_null_violation
      return err.column ? `${err.column} is required.` : 'A required field is missing.';
    case '22P02': // invalid_text_representation (bad int/uuid/etc cast)
      return 'One of the submitted values is not in the expected format.';
    default:
      return null;
  }
}

app.use((err, _req, res, _next) => {
  console.error('[API Error]', err?.message || err?.toString(), err?.code || '');
  if (err.status === 401 || err.status === 403) {
    return res.status(err.status).json({ error: err.message });
  }
  const friendly = pgFriendlyMessage(err);
  if (friendly) return res.status(400).json({ error: friendly });
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

module.exports = app;
