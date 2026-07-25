import { apiFetch, parseJsonOrThrow } from './apiFetch';
const BASE = '/api/reports';

export async function getTrialBalance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/trial-balance${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProfitLoss(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/profit-loss${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getArAging(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/ar-aging${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getApAging(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/ap-aging${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-summary${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPurchaseSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/purchase-summary${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCustomerLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/customer-ledger${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCustomerBalance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/customer-balance${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getVendorBalance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-balance${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSaleInvoiceReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-invoice${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPurchaseInvoiceReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/purchase-invoice${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getExpenseReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/expense-report${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getAccountLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/account-ledger${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCreditNoteReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/credit-note-report${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getDebitNoteReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/debit-note-report${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getDueInvoiceReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/due-invoice${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockAdjustmentReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-adjustment-report${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockMovementReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-movement-report${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesByMonth(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-by-month${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProductSalesHistory(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/product-sales-history${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getEmployeeReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/employee-report${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── New Sales Reports ────────────────────────────────────────────────────────

export async function getCustLoyalty(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-loyalty${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCustBalDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-bal-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSoUndelivered(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/so-undelivered${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCustSalesAnalysis(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-sales-analysis${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesTarget(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-target${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCustRefund(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-refund${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProdSalesCat(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-sales-cat${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSaleDelivery(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-delivery${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSaleReturn(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-return${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSaleReturnDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-return-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSaleInvoiceDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-invoice-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProdSaleCust(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-sale-cust${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSoDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/so-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSaleOrder(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-order${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProdProfit(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-profit${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getLeadFees(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/lead-fees${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProdRate(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-rate${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getInvoiceReturnSp(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/invoice-return-sp${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesPerfSp(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-perf-sp${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCustLedgerBulk(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-ledger-bulk${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getDiscountSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/discount-summary${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSiDetailUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/si-detail-ug${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSrDetailUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sr-detail-ug${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getInvoiceProfit(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/invoice-profit${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getNegPayment(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/neg-payment${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getNegPaymentDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/neg-payment-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getNegPaymentUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/neg-payment-ug${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getDistMargin(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/dist-margin${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── Purchase Reports ─────────────────────────────────────────────────────────

export async function getVendorPayment(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-payment${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getVendorRefund(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-refund${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getVendorWiseProd(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-wise-prod${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getGoodReceiving(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/good-receiving${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPurchaseReturn(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/purchase-return${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPiDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/pi-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPoDetailUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/po-detail-ug${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPiDetail2(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/pi-detail-2${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getPoPending(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/po-pending${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── Inventory Reports ────────────────────────────────────────────────────────

export async function getWhLocationStock(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/wh-location-stock${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getLowInventory(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/low-inventory${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getProdCategory(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-category${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockOnHandVal(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-on-hand-val${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getShortExpiry(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/short-expiry${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockTracking(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-tracking${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getNegativeStock(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/negative-stock${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockValuation(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-valuation${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockDiscrepancy(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-discrepancy${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getBatchWiseStock(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/batch-wise-stock${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTransferDisc(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/transfer-disc${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTransferOut(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/transfer-out${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTransferIn(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/transfer-in${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getInTransit(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/in-transit${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getStockOnHandHist(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-on-hand-hist${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── Accounts Reports ─────────────────────────────────────────────────────────

export async function getCourierLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/courier-ledger${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getOtherContactLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/other-contact-ledger${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getOcTransactions(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/oc-transactions${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getConsolidatedLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/consolidated-ledger${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTxnList(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/txn-list${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTaxCollected(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/tax-collected${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTaxPaid(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/tax-paid${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getTrialSixCol(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/trial-six-col${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getOtherCollection(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/other-collection${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getOtherPaymentRpt(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/other-payment-rpt${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── Business Overview Reports ────────────────────────────────────────────────

export async function getBalanceSheet(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/balance-sheet${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getBusinessSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/business-summary${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getAuditLog(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/audit-log${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── CRM Reports ──────────────────────────────────────────────────────────────

export async function getCallEngagement(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/call-engagement${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getLeadsCrm(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/leads-crm${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getLeadsDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/leads-detail${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getLeadStatus(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/lead-status${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ── Manufacturing Reports ────────────────────────────────────────────────────

export async function getMaterialIssuance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/material-issuance${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getJoExpense(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/jo-expense${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getJoProduction(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/jo-production${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getJoValidation(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/jo-validation${q}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}


