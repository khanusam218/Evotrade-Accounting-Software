import { useEffect, useMemo, useState } from 'react';
import { getWarehouses } from '../api/warehouses';
import { getProductCategories, getBrands, getProducts } from '../api/products';
import type { Warehouse } from '../types/warehouse';
import type { Brand, Product, ProductCategory } from '../types/product';
import {
  getTrialBalance, getProfitLoss, getArAging, getApAging, getSalesSummary, getPurchaseSummary, getStockReport,
  getCustomerLedger, getCustomerBalance, getVendorBalance, getSaleInvoiceReport, getPurchaseInvoiceReport,
  getExpenseReport, getAccountLedger, getCreditNoteReport, getDebitNoteReport, getDueInvoiceReport,
  getStockAdjustmentReport, getStockMovementReport, getSalesByMonth, getProductSalesHistory, getEmployeeReport,
  getCustLoyalty, getCustBalDetail, getSoUndelivered, getCustSalesAnalysis, getSalesTarget,
  getCustRefund, getProdSalesCat, getSaleDelivery, getSaleReturn, getSaleReturnDetail,
  getSaleInvoiceDetail, getProdSaleCust, getSoDetail, getSaleOrder, getProdProfit,
  getLeadFees, getProdRate, getInvoiceReturnSp, getSalesPerfSp, getCustLedgerBulk,
  getDiscountSummary, getSiDetailUg, getSrDetailUg, getInvoiceProfit, getNegPayment,
  getNegPaymentDetail, getNegPaymentUg, getDistMargin,
  getVendorPayment, getVendorRefund, getVendorWiseProd, getGoodReceiving, getPurchaseReturn,
  getPiDetail, getPoDetailUg, getPiDetail2, getPoPending,
  getWhLocationStock, getLowInventory, getProdCategory, getStockOnHandVal, getShortExpiry,
  getStockTracking, getNegativeStock, getStockValuation, getStockDiscrepancy, getBatchWiseStock,
  getTransferDisc, getTransferOut, getTransferIn, getInTransit, getStockOnHandHist,
  getCourierLedger, getOtherContactLedger, getOcTransactions, getConsolidatedLedger,
  getTxnList, getTaxCollected, getTaxPaid, getTrialSixCol, getOtherCollection, getOtherPaymentRpt,
  getBalanceSheet, getBusinessSummary, getAuditLog,
  getCallEngagement, getLeadsCrm, getLeadsDetail, getLeadStatus,
  getMaterialIssuance, getJoExpense, getJoProduction, getJoValidation
} from '../api/reports';

const fmt = (n: number | string) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Report catalogue (matches Splendid exactly) ──────────────────────────────

interface ReportDef {
  id: string;
  name: string;
  desc: string;
  isNew?: boolean;
  apiKey?: string; // which existing API to call
}

interface Category { section: string; reports: ReportDef[]; }
interface Column { categories: Category[]; }

const COLUMNS: Column[] = [
  {
    categories: [
      {
        section: 'Sales',
        reports: [
          { id: 'cust-loyalty',        name: 'Customer Loyalty Program Ledger',      apiKey: 'cust-loyalty', desc: 'Report displays a listing of all transactions for selected customer, within a specified date range.' },
          { id: 'cust-bal-detail',     name: 'Customer Balance Detail Report',        apiKey: 'cust-bal-detail', desc: 'This report provides a detailed analysis of balance sheet items for each customer.' },
          { id: 'so-undelivered',      name: 'Sale Order Un-delivered Detail Report', apiKey: 'so-undelivered', desc: 'This report highlights the partially or fully un-delivered sale orders.' },
          { id: 'sales-by-month',      name: 'Sales By Month',                        apiKey: 'sales-by-month', desc: 'This report provides a detailed overview of monthly sales performance for each customer.' },
          { id: 'prod-sales-hist',     name: 'Product Sales History Report',          apiKey: 'product-sales-history', desc: 'This report is crucial for understanding the historical sales performance of products; identifying market trends, and making informed decisions about pricing, promotions, and inventory management.' },
          { id: 'cust-sales-analysis', name: 'Customer Sales Analysis Report',        apiKey: 'cust-sales-analysis', desc: 'This report shows all of the sales by customer; offering key insights into purchasing patterns, revenue generation, and customer behavior.' },
          { id: 'sales-target',        name: 'Sales Target and Commissions',          apiKey: 'sales-target', desc: 'This report gives the detail of sale target and commissions.' },
          { id: 'ar-aging',            name: 'Aged Account Receivable Report',        apiKey: 'ar-aging', desc: 'This report gives an independent customer listing of the business or company invoices by customer category.' },
          { id: 'cust-ledger',         name: 'Customer Ledger',                       apiKey: 'customer-ledger', desc: 'This report provides a listing of all transactions for selected Customer; within a specified date range.' },
          { id: 'cust-bal',            name: 'Customer Balance Report',               apiKey: 'customer-balance', desc: 'This report gives a listing of all the balance of all the customers categorized by customer category.' },
          { id: 'sale-invoice',        name: 'Sale Invoice Report',                   apiKey: 'sale-invoice', desc: 'This report helps you analyze the performance of your business.' },
          { id: 'cust-refund',         name: 'Customer Refund Report',                apiKey: 'cust-refund', desc: 'Review all the refunds for the customer either undisclosed or allocated with any Invoice, or not payment filtered by a specific date range.' },
          { id: 'prod-sales-cat',      name: 'Product Sales Category Report',         apiKey: 'prod-sales-cat', desc: 'This report provides a listing of all sold products category wise displaying the average cost of the product also.' },
          { id: 'sale-delivery',       name: 'Sale Delivery Report',                  apiKey: 'sale-delivery', desc: 'List all sales delivery challan in a specified date range of all or a single customer.' },
          { id: 'sale-return',         name: 'Sale Return Report',                    apiKey: 'sale-return', desc: 'This report gives the detail of sales return and the products/services associated with that return within the date range.' },
          { id: 'sale-return-detail',  name: 'Sale Return Detail Report',             apiKey: 'sale-return-detail', desc: 'This report gives the detail of sales returns and the products/services associated with that return within the date range.' },
          { id: 'sale-invoice-detail', name: 'Sale Invoice Detail Report',            apiKey: 'sale-invoice-detail', desc: 'This report gives the detail of sales invoices and the products/services associated with that invoice within the date range.' },
          { id: 'prod-sale-cust',      name: 'Product Sale Customer-Wise Report',     apiKey: 'prod-sale-cust', desc: 'Provides the history of the sold product by customers in a specified date range.' },
          { id: 'so-detail',           name: 'Sale Order Detail Report',              apiKey: 'so-detail', desc: 'This report gives the detail of Sale Orders and the products/services associated with that order within the date range.' },
          { id: 'sale-order',          name: 'Sale Order Report',                     apiKey: 'sale-order', desc: 'This can help you analyze sale orders performance of your business.' },
          { id: 'prod-profit',         name: 'Product Profit Report',                 apiKey: 'prod-profit', desc: 'Provides the profitability against all sold products and categories in a specified date range.' },
          { id: 'lead-fees',           name: 'Lead Fees Report',                      apiKey: 'lead-fees', desc: 'This report shows aggregated product quantities ordered, invoiced and from & past due date invoices along with the performance of given date range according to sale order.' },
          { id: 'due-invoice',         name: 'Due Invoice Report',                    apiKey: 'due-invoice', desc: 'This report lists unpaid overdue customer invoices.' },
          { id: 'prod-rate',           name: 'Product Rate Report',                   apiKey: 'prod-rate', desc: 'Provides the sale rate of all products.' },
          { id: 'invoice-return-sp',   name: 'Sale Invoice Return Person Report',     apiKey: 'invoice-return-sp', desc: 'This report shows all the sales invoices and the products/services associated with that invoice filtered by sales person.' },
          { id: 'sales-perf-sp',       name: 'Sales Performance by Sales Person Report', apiKey: 'sales-perf-sp', desc: 'This report shows the sales persons progress in terms of number of invoices, average invoice amount and working days for the given date range.' },
          { id: 'cust-ledger-bulk',    name: 'Customer Ledger (Bulk) Report',         apiKey: 'cust-ledger-bulk', desc: 'This report gives the detail of all transactions for multiple customers, within a specified date range.' },
          { id: 'discount-summary',    name: 'Discount Summary Report',               apiKey: 'discount-summary', desc: 'This report gives the detail of discount in sales invoices and the products/services associated with that invoice within the date range.' },
          { id: 'si-detail-ug',        name: 'Sale Invoice Detail Report (Ungrouped)', apiKey: 'si-detail-ug', desc: 'This report gives the detail (ungrouped) of sales invoices and the products/services associated with that invoice within the date range.' },
          { id: 'sr-detail-ug',        name: 'Sale Return Detail Report (Ungrouped)', apiKey: 'sr-detail-ug', desc: 'This report gives the detail (ungrouped) of sales returns and the products/services associated with that return within the date range.' },
          { id: 'invoice-profit',      name: 'Invoice Wise Profit Report',            apiKey: 'invoice-profit', desc: 'This report lists on Invoice profit on sale invoice products in a specified date range.' },
          { id: 'neg-payment',         name: 'Negative Payment Report',               apiKey: 'neg-payment', desc: 'Shows all the receive payment either allocated or unallocated with any Invoice, filtered by customer by a specific date range.' },
          { id: 'neg-payment-detail',  name: 'Negative Payment Detail Report',        apiKey: 'neg-payment-detail', desc: 'Shows all the receive payment either allocated or unallocated with any invoice filtered by customer, filtered by a specific date range.' },
          { id: 'neg-payment-ug',      name: 'Negative Payment Detail Report (Ungrouped)', apiKey: 'neg-payment-ug', desc: 'Shows all the receive payment either allocated or unallocated with any discounts, filtered by the customer by a specific date range.' },
          { id: 'dist-margin',         name: 'Distributor Margin Detail Report',      apiKey: 'dist-margin', desc: 'This report displays a listing of product margin charges of product freight distribution within the date range.' },
        ],
      },
    ],
  },
  {
    categories: [
      {
        section: 'Manufacturing',
        reports: [
          { id: 'material-issuance',  name: 'Material Issuance Report',    apiKey: 'material-issuance', desc: 'This report lists all the materials used for product manufacture within a specified date range.' },
          { id: 'jo-expense',         name: 'Job Order Expense Report',     apiKey: 'jo-expense', desc: 'It will lists all expenses against job order within a specified date range.' },
          { id: 'jo-production',      name: 'Job Order Production Report',  apiKey: 'jo-production', desc: 'This report will be shown which costs are negative.' },
          { id: 'jo-validation',      name: 'Job Order Validation Report',  apiKey: 'jo-validation', desc: 'This report will be shown which costs are negative.' },
        ],
      },
      {
        section: 'Purchases',
        reports: [
          { id: 'ap-aging',           name: 'Aged Account Payable Report',              apiKey: 'ap-aging', desc: 'This report gives an independent vendor listing of the business or company invoices by vendor category.' },
          { id: 'vendor-bal',         name: 'Vendor Balance Report',                    apiKey: 'vendor-balance', desc: 'This report gives a listing of all balances of all the vendors categorized by vendor category.' },
          { id: 'vendor-payment',     name: 'Vendor Payment Report',                    apiKey: 'vendor-payment', desc: 'This gives a list of balance of all the vendors allocated or unallocated with any purchase invoices, filtered by this vendor within a specified date range.' },
          { id: 'purchase-invoice',   name: 'Purchase Invoice Report',                  apiKey: 'purchase-invoice', desc: 'This report shows all the purchases of your business for the selected period of all or a selected vendor.' },
          { id: 'vendor-refund',      name: 'Vendor Refund Report',                     apiKey: 'vendor-refund', desc: 'Review all the refunds by vendor either allocated or unallocated with any invoice, return or payment filtered by vendor or by a specific date range.' },
          { id: 'vendor-wise-prod',   name: 'Vendor Wise Product Purchases Report',     apiKey: 'vendor-wise-prod', desc: 'Provides you insight of the purchases made for various products affecting your business.' },
          { id: 'good-receiving',     name: 'Good Receiving Report',                    apiKey: 'good-receiving', desc: 'This report provides information about all the products that have been received in a condition within a specified date range from a single or multiple vendors.' },
          { id: 'purchase-return',    name: 'Purchase Return Report',                   apiKey: 'purchase-return', desc: 'This report gives information about all the products returned to the vendor within a specified date range from a single or multiple vendors.' },
          { id: 'pi-detail',          name: 'Purchase Invoice Detail Report',           apiKey: 'pi-detail', desc: 'This report gives a detailed review of all the business purchase invoices to analyze the purchase transactions of the business in detail.' },
          { id: 'po-detail-ug',       name: 'Purchase Order Detail Report (Ungrouped)', apiKey: 'po-detail-ug', desc: 'This report lists all the products returned back to the vendor, user can filter the records based on the Date, Branch, Product, brand, category, vendor.' },
          { id: 'pi-detail-2',        name: 'Purchase Invoice Detail Report',           apiKey: 'pi-detail-2', desc: 'This report gives a detailed review of all the business purchase invoices to analyze the purchase transactions of the business in detail.' },
          { id: 'po-pending',         name: 'Purchase Order Report (Pending Orders)',   apiKey: 'po-pending', desc: 'This report shows all the purchase orders of the selected period of all or a selected vendor.' },
        ],
      },
      {
        section: 'CRM',
        reports: [
          { id: 'call-engagement',    name: 'Call Engagement Insights',   apiKey: 'call-engagement', desc: 'This report provides a detailed overview of the performance of the team members in the prospects. It includes information such as the total number of calls made, total outreach strategies, and enhancing the overall effectiveness of the sales effort.' },
          { id: 'leads-crm',         name: 'Leads CRM',                  apiKey: 'leads-crm', desc: 'This report is a valuable tool for evaluating the effectiveness of sales calls, optimizing outreach strategies, and enhancing the overall effectiveness of the sales effort.' },
          { id: 'leads-detail',       name: 'Leads Detail Report',         apiKey: 'leads-detail', desc: 'This report is essential for managing and tracking individual leads, providing sales teams with the necessary insights to optimize their sales processes and ensure timely follow-ups, and templates lead management.' },
          { id: 'lead-status',        name: 'Lead Status Summary Report',  apiKey: 'lead-status', desc: 'This report provides a comprehensive overview of the current status of all leads within the sales pipeline. It summarizes the total number of leads in each stage, their current stage and next steps.' },
        ],
      },
    ],
  },
  {
    categories: [
      {
        section: 'Business Overview',
        reports: [
          { id: 'balance-sheet',      name: 'Balance Sheet',      apiKey: 'balance-sheet', desc: 'A statement of the assets, liabilities, and owner\'s equity.' },
          { id: 'profit-loss',        name: 'Profit and Loss',    apiKey: 'profit-loss', desc: 'This summarizes the revenues, costs and expenses incurred during a specified period.' },
          { id: 'business-summary',   name: 'Business Summary',   apiKey: 'business-summary', desc: 'Daily business gives you an snapshot on your business of a particular node.' },
          { id: 'audit-log',          name: 'Audit Log',          apiKey: 'audit-log', desc: 'Tracked the logs of activities performed by any user registered in the system.' },
        ],
      },
      {
        section: 'Accounts',
        reports: [
          { id: 'courier-ledger',     name: 'Courier Ledger Report',      apiKey: 'courier-ledger', desc: 'Report displays a listing of all transactions for selected Courier, within a specified date range.' },
          { id: 'other-contact-ledger', name: 'Other Contact Ledger',     apiKey: 'other-contact-ledger', desc: 'Report displays a listing of all transactions for selected Other Contact, within a specified date range.' },
          { id: 'oc-transactions',    name: 'Transactions for selected other contacts', apiKey: 'oc-transactions', desc: 'Transactions for selected other contacts.' },
          { id: 'account-ledger',     name: 'Account Ledger',             apiKey: 'account-ledger', desc: 'An account ledger is a record used to record the specific transactions for each account in a ledger account within a specified date range.' },
          { id: 'expense-report',     name: 'Expense Report',             apiKey: 'expense-report', desc: 'An expense report is displaying business expenses account within a specified date range.' },
          { id: 'credit-note',        name: 'Credit Note Report',         apiKey: 'credit-note-report', desc: 'List all the credit note issued to your customer/vendor within a specified date range from a single or all the credit note range.' },
          { id: 'debit-note',         name: 'Debit Note Report',          apiKey: 'debit-note-report', desc: 'List all the debit note issued to your vendor/customer within a specified date range from a single or all the debit note range.' },
          { id: 'consolidated-ledger', name: 'Consolidated Ledger (Customer & Vendor)', apiKey: 'consolidated-ledger', desc: 'This report displays the consolidated transactional activities of a contact selected as customers and also as a vendor.' },
          { id: 'trial-balance',      name: 'Trial Balance',              apiKey: 'trial-balance', desc: 'A trial balance is a bookkeeping worksheet in which the balance of all ledgers are compiled into debit and credit account column totals that are equal.' },
          { id: 'txn-list',           name: 'Transaction List Report',    apiKey: 'txn-list', desc: 'Provides the most detailed information on the state of general ledger of each transaction in the system.' },
          { id: 'tax-collected',      name: 'Tax Collected on Sales Report', apiKey: 'tax-collected', desc: 'It will lists all the tax collection from customers against sale of any product within a specified date range.' },
          { id: 'tax-paid',           name: 'Tax Paid on Purchases Report', apiKey: 'tax-paid', desc: 'It will lists all the tax paid to vendors against purchase of any product within a specified date range.' },
          { id: 'trial-six-col',      name: 'Trial Balance Report (Six Column)', apiKey: 'trial-six-col', desc: 'A trial balance is a bookkeeping worksheet in which the balance of all accounts are compiled into debit and credit balance column totals that are equal within given range.' },
          { id: 'employee-report',    name: 'Employee Report',            apiKey: 'employee-report', desc: 'An employee report is used to display company\'s transactions against a particular account within a specified date range.' },
          { id: 'other-collection',   name: 'Other Collection Report',    apiKey: 'other-collection', desc: 'Provides the detail of Other Collection Report.' },
          { id: 'other-payment-rpt',  name: 'Other Payment Report',       apiKey: 'other-payment-rpt', desc: 'Provides the detail of Other Payment Report.' },
        ],
      },
      {
        section: 'Inventory',
        reports: [
          { id: 'wh-location-stock',  name: 'Warehouse Location Wise Stock Report', apiKey: 'wh-location-stock', desc: 'It will lists of all the stock of products in the warehouse location.' },
          { id: 'low-inventory',      name: 'Low Inventory Report',       apiKey: 'low-inventory', desc: 'It will lists the products which are low in stock based on minimum stock levels or below which were set.' },
          { id: 'prod-category',      name: 'Product Category Report',    apiKey: 'prod-category', desc: 'This report will list all the transactional activity of the product in a specified date range for a single branch.' },
          { id: 'stock-adjustment',   name: 'Stock Adjustment',           apiKey: 'stock-adjustment-report', desc: 'This will list all the transactions for product categories; used to change the opening or balance, destory or loss.' },
          { id: 'stock-on-hand',      name: 'Stock On Hand Report',       apiKey: 'stock', desc: 'A summary of inventory holding either a debit balance or a credit balance.' },
          { id: 'stock-on-hand-val',  name: 'Stock On Hand Report (With Value)', apiKey: 'stock-on-hand-val', desc: 'Provides a summary of inventory holding; a provides a detailed information about the value.' },
          { id: 'stock-movement',     name: 'Stock Movement',             apiKey: 'stock-movement-report', desc: 'A summary of products belonging to a product that moved from one to another.' },
          { id: 'short-expiry',       name: 'Short Expiry Stock',         apiKey: 'short-expiry', desc: 'A summary of listing of all the products which are going to be expire in a while. You can also review the expiry balance sheet defined against each product.' },
          { id: 'stock-tracking',     name: 'Stock Tracking Report',      apiKey: 'stock-tracking', desc: 'This report can be used to easily analyze product tracking in, and walk past showing filterable data range and products category.' },
          { id: 'negative-stock',     name: 'Negative Stock Report',      apiKey: 'negative-stock', desc: 'Identifies the products that are going from Positive Stock to negative. This report specifically searches for specific products that moved from positive to negative.' },
          { id: 'stock-valuation',    name: 'Stock Valuation Report',     apiKey: 'stock-valuation', desc: 'Calculation used to assign a monetary value to manage inventory cost and help used to track negative stock.' },
          { id: 'stock-discrepancy',  name: 'Stock Discrepancy Report',   apiKey: 'stock-discrepancy', desc: 'Report for potential stock discrepancies, delivered without sales invoices, good receiving note without purchase invoices, returns that would change the inventory and discrepancy the stock report.' },
          { id: 'batch-wise-stock',   name: 'Batch Wise Stock Report',    apiKey: 'batch-wise-stock', desc: 'List all the batch enabled products and their quantities in a Warehouse in a Inventory.' },
          { id: 'transfer-disc',      name: 'Transfer Discrepancy Report', apiKey: 'transfer-disc', desc: 'This reports list all internal stock transfer discrepancy data, to allow to review entities can make the transfer discrepancy that moved from one store to another.' },
          { id: 'transfer-out',       name: 'Transfer Out Report',        apiKey: 'transfer-out', desc: 'A summary of products belonging to a branch that was transferred out to another.' },
          { id: 'transfer-in',        name: 'Transfer In Report',         apiKey: 'transfer-in', desc: 'A summary of products belonging to a branch that moved from one to another.' },
          { id: 'in-transit',         name: 'In Transit Detail Report',   apiKey: 'in-transit', desc: 'This report list all the inventory that is in transit (i.e. inventory that has been sent to transfer but has not yet been received or confirmed).' },
          { id: 'stock-on-hand-hist', name: 'Stock On Hand History Report', apiKey: 'stock-on-hand-hist', desc: 'A summary, belonging to a branch that describes the Product of products of each division.' },
        ],
      },
    ],
  },
];

// ── Low Inventory Report ─────────────────────────────────────────────────────

interface LowInventoryRow {
  product_code: string;
  product_name: string;
  warehouse_name: string;
  quantity_in_stock: number;
  low_threshold: number;
}

type SortKey = 'product_name' | 'warehouse_name' | 'low_threshold';

function printLowInventory(rows: LowInventoryRow[]) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Low Inventory Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .company { font-size: 22px; font-weight: bold; }
    .report-title { font-size: 22px; font-weight: bold; }
    hr { border: none; border-top: 1.5px solid #000; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr th { text-align: left; font-weight: bold; padding: 6px 8px; border-bottom: 1.5px solid #000; font-size: 13px; }
    tbody tr td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
    td.num, th.num { text-align: right; }
    @media print { body { padding: 20px; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
    <span class="company">Evotrade</span>
    <span class="report-title">Low Inventory Report</span>
  </div>
  <hr/>
  <table>
    <thead>
      <tr>
        <th>Product Code</th><th>Product Name</th><th>Warehouse Name</th>
        <th class="num">Quantity In Stock</th><th class="num">Low Threshold</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
      <tr>
        <td>${r.product_code}</td>
        <td>${r.product_name}</td>
        <td>${r.warehouse_name}</td>
        <td class="num">${r.quantity_in_stock}</td>
        <td class="num">${r.low_threshold}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

function exportLowInventoryToExcel(rows: LowInventoryRow[]) {
  const headers = ['Product Code', 'Product Name', 'Warehouse Name', 'Quantity In Stock', 'Low Threshold'];
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      escape(r.product_code), escape(r.product_name), escape(r.warehouse_name),
      escape(r.quantity_in_stock), escape(r.low_threshold),
    ].join(',')),
  ];
  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'LowInventoryReport.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function LowInventoryReport({ onBack }: { onBack: () => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands,     setBrands]     = useState<Brand[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);

  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId,  setCategoryId]  = useState('');
  const [brandId,     setBrandId]     = useState('');
  const [productId,   setProductId]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [rows,    setRows]    = useState<LowInventoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('product_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    getWarehouses().then(setWarehouses).catch(() => {});
    getProductCategories().then(setCategories).catch(() => {});
    getBrands().then(setBrands).catch(() => {});
    getProducts({ page: 1, limit: 1000 }).then(r => setProducts(r.data)).catch(() => {});
  }, []);

  async function handleShow() {
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = {};
      if (warehouseId)  params.warehouse_id = warehouseId;
      if (categoryId)   params.category_id  = categoryId;
      if (brandId)      params.brand_id     = brandId;
      if (productId)    params.product_id   = productId;
      if (statusFilter) params.is_active    = statusFilter;
      setRows(await getLowInventory(params));
    } catch (e: any) {
      setError(e.message); setRows(null);
    } finally { setLoading(false); }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sortedRows = useMemo(() => {
    if (!rows) return null;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const selectCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white';

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <th className="table-th cursor-pointer select-none" onClick={() => toggleSort(sortField)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <svg className={`w-3 h-3 ${sortKey === sortField ? 'text-gray-700' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
          {sortKey === sortField && sortDir === 'desc'
            ? <path d="M7 10l5 5 5-5H7z" />
            : <path d="M7 14l5-5 5 5H7z" />}
        </svg>
      </span>
    </th>
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reports
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-gray-800">Low Inventory Report</h1>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-5 gap-4 mb-5 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
          <select className={selectCls} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
            <option value="">-All-</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
          <select className={selectCls} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">-All-</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
          <select className={selectCls} value={brandId} onChange={e => setBrandId(e.target.value)}>
            <option value="">-All-</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <select className={selectCls} value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">-All-</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Status</label>
          <select className={selectCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">-All-</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={handleShow} disabled={loading}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded transition-colors disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {loading ? 'Loading…' : 'SHOW'}
        </button>
        <button onClick={() => rows && printLowInventory(sortedRows ?? rows)} disabled={!rows || rows.length === 0}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-semibold px-5 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
          </svg>
          PRINT
        </button>
        <button onClick={() => rows && exportLowInventoryToExcel(sortedRows ?? rows)} disabled={!rows || rows.length === 0}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-semibold px-5 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2-8H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V8l-6-6z" />
          </svg>
          EXPORT TO EXCEL
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

      {sortedRows && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Product Code</th>
                <SortHeader label="Product Name" sortField="product_name" />
                <SortHeader label="Warehouse Name" sortField="warehouse_name" />
                <th className="table-th text-right">Quantity In Stock</th>
                <SortHeader label="Low Threshold" sortField="low_threshold" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={5} className="table-td text-center text-gray-400 py-8">No products are below their minimum stock level.</td></tr>
              )}
              {sortedRows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="table-td font-mono text-xs">{r.product_code}</td>
                  <td className="table-td">{r.product_name}</td>
                  <td className="table-td">{r.warehouse_name}</td>
                  <td className={`table-td text-right font-mono text-xs ${Number(r.quantity_in_stock) <= 0 ? 'text-red-600 font-semibold' : ''}`}>
                    {r.quantity_in_stock}
                  </td>
                  <td className="table-td text-right font-mono text-xs">{r.low_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Runner for existing reports ───────────────────────────────────────────────

function ReportRunner({ report, onBack }: { report: ReportDef; onBack: () => void }) {
  const today     = new Date().toISOString().split('T')[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo,   setDateTo]   = useState(today);
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const p = { date_from: dateFrom, date_to: dateTo, as_of: dateTo };
      let result;
      if (report.apiKey === 'trial-balance')        result = await getTrialBalance({ date_to: dateTo });
      else if (report.apiKey === 'profit-loss')     result = await getProfitLoss(p);
      else if (report.apiKey === 'ar-aging')        result = await getArAging({ as_of: dateTo });
      else if (report.apiKey === 'ap-aging')        result = await getApAging({ as_of: dateTo });
      else if (report.apiKey === 'sales-sum')       result = await getSalesSummary(p);
      else if (report.apiKey === 'purch-sum')       result = await getPurchaseSummary(p);
      else if (report.apiKey === 'stock')           result = await getStockReport();
      else if (report.apiKey === 'customer-ledger') result = await getCustomerLedger(p);
      else if (report.apiKey === 'customer-balance') result = await getCustomerBalance();
      else if (report.apiKey === 'vendor-balance')  result = await getVendorBalance();
      else if (report.apiKey === 'sale-invoice')    result = await getSaleInvoiceReport(p);
      else if (report.apiKey === 'purchase-invoice') result = await getPurchaseInvoiceReport(p);
      else if (report.apiKey === 'expense-report')  result = await getExpenseReport(p);
      else if (report.apiKey === 'account-ledger')  result = await getAccountLedger(p);
      else if (report.apiKey === 'credit-note-report') result = await getCreditNoteReport(p);
      else if (report.apiKey === 'debit-note-report') result = await getDebitNoteReport(p);
      else if (report.apiKey === 'due-invoice')     result = await getDueInvoiceReport({ as_of: dateTo });
      else if (report.apiKey === 'stock-adjustment-report') result = await getStockAdjustmentReport(p);
      else if (report.apiKey === 'stock-movement-report') result = await getStockMovementReport(p);
      else if (report.apiKey === 'sales-by-month')  result = await getSalesByMonth(p);
      else if (report.apiKey === 'product-sales-history') result = await getProductSalesHistory(p);
      else if (report.apiKey === 'employee-report') result = await getEmployeeReport();
      // ── New Sales Reports ──
      else if (report.apiKey === 'cust-loyalty')        result = await getCustLoyalty(p);
      else if (report.apiKey === 'cust-bal-detail')     result = await getCustBalDetail();
      else if (report.apiKey === 'so-undelivered')      result = await getSoUndelivered();
      else if (report.apiKey === 'cust-sales-analysis') result = await getCustSalesAnalysis(p);
      else if (report.apiKey === 'sales-target')        result = await getSalesTarget(p);
      else if (report.apiKey === 'cust-refund')         result = await getCustRefund(p);
      else if (report.apiKey === 'prod-sales-cat')      result = await getProdSalesCat(p);
      else if (report.apiKey === 'sale-delivery')       result = await getSaleDelivery(p);
      else if (report.apiKey === 'sale-return')         result = await getSaleReturn(p);
      else if (report.apiKey === 'sale-return-detail')  result = await getSaleReturnDetail(p);
      else if (report.apiKey === 'sale-invoice-detail') result = await getSaleInvoiceDetail(p);
      else if (report.apiKey === 'prod-sale-cust')      result = await getProdSaleCust(p);
      else if (report.apiKey === 'so-detail')           result = await getSoDetail(p);
      else if (report.apiKey === 'sale-order')          result = await getSaleOrder(p);
      else if (report.apiKey === 'prod-profit')         result = await getProdProfit(p);
      else if (report.apiKey === 'lead-fees')           result = await getLeadFees(p);
      else if (report.apiKey === 'prod-rate')           result = await getProdRate();
      else if (report.apiKey === 'invoice-return-sp')   result = await getInvoiceReturnSp(p);
      else if (report.apiKey === 'sales-perf-sp')       result = await getSalesPerfSp(p);
      else if (report.apiKey === 'cust-ledger-bulk')    result = await getCustLedgerBulk(p);
      else if (report.apiKey === 'discount-summary')    result = await getDiscountSummary(p);
      else if (report.apiKey === 'si-detail-ug')        result = await getSiDetailUg(p);
      else if (report.apiKey === 'sr-detail-ug')        result = await getSrDetailUg(p);
      else if (report.apiKey === 'invoice-profit')      result = await getInvoiceProfit(p);
      else if (report.apiKey === 'neg-payment')         result = await getNegPayment(p);
      else if (report.apiKey === 'neg-payment-detail')  result = await getNegPaymentDetail(p);
      else if (report.apiKey === 'neg-payment-ug')      result = await getNegPaymentUg(p);
      else if (report.apiKey === 'dist-margin')         result = await getDistMargin(p);
      // ── Purchase Reports ──
      else if (report.apiKey === 'vendor-payment')      result = await getVendorPayment(p);
      else if (report.apiKey === 'vendor-refund')       result = await getVendorRefund(p);
      else if (report.apiKey === 'vendor-wise-prod')    result = await getVendorWiseProd(p);
      else if (report.apiKey === 'good-receiving')      result = await getGoodReceiving(p);
      else if (report.apiKey === 'purchase-return')     result = await getPurchaseReturn(p);
      else if (report.apiKey === 'pi-detail')           result = await getPiDetail(p);
      else if (report.apiKey === 'po-detail-ug')        result = await getPoDetailUg(p);
      else if (report.apiKey === 'pi-detail-2')         result = await getPiDetail2(p);
      else if (report.apiKey === 'po-pending')          result = await getPoPending(p);
      // ── Inventory Reports ──
      else if (report.apiKey === 'wh-location-stock')   result = await getWhLocationStock();
      else if (report.apiKey === 'low-inventory')       result = await getLowInventory();
      else if (report.apiKey === 'prod-category')       result = await getProdCategory();
      else if (report.apiKey === 'stock-on-hand-val')   result = await getStockOnHandVal();
      else if (report.apiKey === 'short-expiry')        result = await getShortExpiry();
      else if (report.apiKey === 'stock-tracking')      result = await getStockTracking();
      else if (report.apiKey === 'negative-stock')      result = await getNegativeStock();
      else if (report.apiKey === 'stock-valuation')     result = await getStockValuation();
      else if (report.apiKey === 'stock-discrepancy')   result = await getStockDiscrepancy();
      else if (report.apiKey === 'batch-wise-stock')    result = await getBatchWiseStock();
      else if (report.apiKey === 'transfer-disc')       result = await getTransferDisc(p);
      else if (report.apiKey === 'transfer-out')        result = await getTransferOut(p);
      else if (report.apiKey === 'transfer-in')         result = await getTransferIn(p);
      else if (report.apiKey === 'in-transit')          result = await getInTransit();
      else if (report.apiKey === 'stock-on-hand-hist')  result = await getStockOnHandHist();
      // ── Accounts Reports ──
      else if (report.apiKey === 'courier-ledger')      result = await getCourierLedger();
      else if (report.apiKey === 'other-contact-ledger') result = await getOtherContactLedger();
      else if (report.apiKey === 'oc-transactions')     result = await getOcTransactions(p);
      else if (report.apiKey === 'consolidated-ledger') result = await getConsolidatedLedger(p);
      else if (report.apiKey === 'txn-list')            result = await getTxnList(p);
      else if (report.apiKey === 'tax-collected')       result = await getTaxCollected(p);
      else if (report.apiKey === 'tax-paid')            result = await getTaxPaid(p);
      else if (report.apiKey === 'trial-six-col')       result = await getTrialSixCol(p);
      else if (report.apiKey === 'other-collection')    result = await getOtherCollection(p);
      else if (report.apiKey === 'other-payment-rpt')   result = await getOtherPaymentRpt(p);
      // ── Business Overview ──
      else if (report.apiKey === 'balance-sheet')       result = await getBalanceSheet({ as_of: dateTo });
      else if (report.apiKey === 'business-summary')    result = await getBusinessSummary({ date: dateTo });
      else if (report.apiKey === 'audit-log')           result = await getAuditLog(p);
      // ── CRM Reports ──
      else if (report.apiKey === 'call-engagement')     result = await getCallEngagement(p);
      else if (report.apiKey === 'leads-crm')           result = await getLeadsCrm();
      else if (report.apiKey === 'leads-detail')        result = await getLeadsDetail();
      else if (report.apiKey === 'lead-status')         result = await getLeadStatus();
      // ── Manufacturing Reports ──
      else if (report.apiKey === 'material-issuance')   result = await getMaterialIssuance(p);
      else if (report.apiKey === 'jo-expense')          result = await getJoExpense(p);
      else if (report.apiKey === 'jo-production')       result = await getJoProduction(p);
      else if (report.apiKey === 'jo-validation')       result = await getJoValidation(p);
      setData(result);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!report.apiKey) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Reports
          </button>
          <span className="text-gray-300">|</span>
          <h1 className="text-xl font-bold text-gray-800">{report.name}</h1>
        </div>
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-500 text-sm">{report.desc}</p>
          <p className="text-gray-400 text-sm mt-3">This report is not yet available. We're still building it out — check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reports
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-gray-800">{report.name}</h1>
      </div>

      {/* Date range + Run */}
      <div className="flex flex-wrap gap-3 items-center mb-5 bg-white p-4 rounded-lg border border-gray-200">
        <label className="text-sm font-medium text-gray-700">From</label>
        <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
          value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <label className="text-sm font-medium text-gray-700">To</label>
        <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
          value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button onClick={run} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded transition-colors disabled:opacity-50">
          {loading ? 'Running…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

      {/* Output */}
      {data && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          {/* Trial Balance */}
          {report.apiKey === 'trial-balance' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Code</th><th className="table-th">Account Name</th>
                  <th className="table-th">Type</th><th className="table-th text-right">Debit</th>
                  <th className="table-th text-right">Credit</th><th className="table-th text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="table-td font-mono text-xs">{r.code}</td>
                    <td className="table-td">{r.name}</td>
                    <td className="table-td text-gray-500">{r.account_type}</td>
                    <td className="table-td text-right">{fmt(r.total_debit)}</td>
                    <td className="table-td text-right">{fmt(r.total_credit)}</td>
                    <td className={`table-td text-right font-medium ${Number(r.balance) < 0 ? 'text-red-600' : ''}`}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Profit & Loss */}
          {report.apiKey === 'profit-loss' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                {[['Revenue', data.summary?.revenue], ['Cost of Goods Sold', data.summary?.cogs], ['Gross Profit', data.summary?.gross_profit], ['Expenses', data.summary?.expenses], ['Net Profit / Loss', data.summary?.net_profit]].map(([label, val], i) => (
                  <div key={i} className="contents">
                    <span className={`text-sm ${i === 4 ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{label}</span>
                    <span className={`text-sm text-right ${Number(val) < 0 ? 'text-red-600' : 'text-gray-800'} ${i === 4 ? 'font-bold' : ''}`}>{fmt(Number(val))}</span>
                  </div>
                ))}
              </div>
              <hr />
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr><th className="table-th">Type</th><th className="table-th">Code</th><th className="table-th">Account</th><th className="table-th text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {data.detail?.map((r: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="table-td text-gray-500">{r.account_type}</td>
                      <td className="table-td font-mono text-xs">{r.code}</td>
                      <td className="table-td">{r.name}</td>
                      <td className={`table-td text-right ${Number(r.amount) < 0 ? 'text-red-600' : ''}`}>{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* AR / AP Aging */}
          {(report.apiKey === 'ar-aging' || report.apiKey === 'ap-aging') && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Number</th>
                  <th className="table-th">{report.apiKey === 'ar-aging' ? 'Customer' : 'Vendor'}</th>
                  <th className="table-th">Date</th><th className="table-th">Due Date</th>
                  <th className="table-th text-right">Total</th><th className="table-th text-right">Balance</th>
                  <th className="table-th text-right">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices?.map((r: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="table-td font-mono text-xs">{r.number}</td>
                    <td className="table-td">{r.customer_name || r.vendor_name}</td>
                    <td className="table-td">{r.date?.slice(0, 10)}</td>
                    <td className="table-td">{r.due_date?.slice(0, 10)}</td>
                    <td className="table-td text-right">{fmt(r.net_amount)}</td>
                    <td className="table-td text-right font-medium">{fmt(r.balance_amount)}</td>
                    <td className={`table-td text-right ${Number(r.days_overdue) > 60 ? 'text-red-600 font-medium' : ''}`}>{r.days_overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Stock */}
          {report.apiKey === 'stock' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Code</th><th className="table-th">Product</th>
                  <th className="table-th">Unit</th><th className="table-th">Warehouse</th>
                  <th className="table-th text-right">Qty On Hand</th>
                  <th className="table-th text-right">Cost Price</th><th className="table-th text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="table-td font-mono text-xs">{r.code}</td>
                    <td className="table-td">{r.product_name}</td>
                    <td className="table-td">{r.unit}</td>
                    <td className="table-td">{r.warehouse_name}</td>
                    <td className="table-td text-right">{Number(r.qty_on_hand).toLocaleString()}</td>
                    <td className="table-td text-right">{fmt(r.unit_cost)}</td>
                    <td className="table-td text-right font-medium">{fmt(r.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Balance Sheet */}
          {report.apiKey === 'balance-sheet' && (
            <div className="p-6 space-y-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr><th className="table-th">Type</th><th className="table-th">Code</th><th className="table-th">Account</th><th className="table-th text-right">Balance</th></tr>
                </thead>
                <tbody>
                  {data.accounts?.map((r: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="table-td text-gray-500">{r.account_type}</td>
                      <td className="table-td font-mono text-xs">{r.code}</td>
                      <td className="table-td">{r.name}</td>
                      <td className={`table-td text-right ${Number(r.balance) < 0 ? 'text-red-600' : ''}`}>{fmt(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid grid-cols-3 gap-4 max-w-lg pt-2 border-t">
                <span className="text-sm font-bold text-gray-800">Total Assets</span>
                <span className="text-sm font-bold text-right">{fmt(data.total_assets)}</span>
                <span></span>
                <span className="text-sm font-bold text-gray-800">Total Liabilities</span>
                <span className="text-sm font-bold text-right">{fmt(data.total_liabilities)}</span>
                <span></span>
                <span className="text-sm font-bold text-gray-800">Total Equity</span>
                <span className="text-sm font-bold text-right">{fmt(data.total_equity)}</span>
              </div>
            </div>
          )}
          {/* Business Summary */}
          {report.apiKey === 'business-summary' && data && (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                {[['Sales Count', data.sales?.count], ['Sales Total', fmt(data.sales?.total || 0)],
                  ['Purchase Count', data.purchases?.count], ['Purchase Total', fmt(data.purchases?.total || 0)],
                  ['Expense Count', data.expenses?.count], ['Expense Total', fmt(data.expenses?.total || 0)]].map(([l, v], i) => (
                  <div key={i} className="contents">
                    <span className="text-sm text-gray-600">{l}</span>
                    <span className="text-sm text-right text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Generic table for all other reports */}
          {!['trial-balance','profit-loss','ar-aging','ap-aging','stock','balance-sheet','business-summary'].includes(report.apiKey || '') && Array.isArray(data) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {data.length > 0 && Object.keys(data[0]).map((key, i) => (
                      <th key={i} className={`table-th ${['amount','total','balance','debit','credit','qty','price','cost','value','profit','margin','revenue','expense','commission','collected','paid','count','rate','pct'].some(s => key.toLowerCase().includes(s)) ? 'text-right' : ''}`}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      {Object.entries(r).map(([key, val], j) => {
                        const isNum = !isNaN(Number(val)) && val !== '' && val !== null;
                        const isDate = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val);
                        return (
                          <td key={j} className={`table-td ${isNum ? 'text-right font-mono text-xs' : ''} ${Number(val) < 0 ? 'text-red-600' : ''}`}>
                            {isDate ? (val as string).slice(0, 10) : isNum ? fmt(Number(val)) : String(val ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Object data fallback (for reports returning { summary, detail } etc) */}
          {!['trial-balance','profit-loss','ar-aging','ap-aging','stock','balance-sheet','business-summary'].includes(report.apiKey || '') && !Array.isArray(data) && data && (
            <div className="p-4 text-sm text-gray-600">
              <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<ReportDef | null>(null);
  const [favorites, setFavorites]     = useState<Set<string>>(new Set());

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(f => {
      const n = new Set(f);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const q = search.toLowerCase();

  // If a report is selected, show its runner (or a "coming soon" state if not yet wired to an API)
  if (selected?.apiKey === 'low-inventory') return <LowInventoryReport onBack={() => setSelected(null)} />;
  if (selected) return <ReportRunner report={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="p-6">
      {/* Title + search */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search reports…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-green-500 w-56"
          />
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-6">
        {COLUMNS.map((col, ci) => (
          <div key={ci} className="space-y-6">
            {col.categories.map(cat => {
              const visible = cat.reports.filter(r =>
                !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
              );
              if (q && visible.length === 0) return null;
              return (
                <div key={cat.section}>
                  {/* Section header */}
                  <h2 className="text-sm font-bold text-gray-800 mb-2">{cat.section}</h2>
                  <div className="space-y-0">
                    {(q ? visible : cat.reports).map(report => (
                      <div
                        key={report.id}
                        className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0 group cursor-pointer"
                        onClick={() => setSelected(report)}
                      >
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-sm font-medium leading-tight ${report.apiKey ? 'text-green-600 hover:text-green-700' : 'text-green-600 hover:text-green-700'}`}>
                              {report.name}
                            </span>
                            {report.isNew && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500 text-white leading-none">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{report.desc}</p>
                        </div>
                        {/* Star */}
                        <button
                          onClick={e => toggleFav(report.id, e)}
                          className="shrink-0 mt-0.5 text-gray-300 hover:text-yellow-400 transition-colors"
                          title="Favourite"
                        >
                          <svg className={`w-4 h-4 ${favorites.has(report.id) ? 'text-yellow-400 fill-yellow-400' : ''}`}
                            fill={favorites.has(report.id) ? 'currentColor' : 'none'}
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
