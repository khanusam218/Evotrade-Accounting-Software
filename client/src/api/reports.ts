import { apiFetch, parseJsonOrThrow } from './apiFetch';
const BASE = '/api/reports';

export async function getTrialBalance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/trial-balance${q}`);
  return parseJsonOrThrow(r);
}

export async function getProfitLoss(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/profit-loss${q}`);
  return parseJsonOrThrow(r);
}

export async function getArAging(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/ar-aging${q}`);
  return parseJsonOrThrow(r);
}

export async function getApAging(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/ap-aging${q}`);
  return parseJsonOrThrow(r);
}

export async function getSalesSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-summary${q}`);
  return parseJsonOrThrow(r);
}

export async function getPurchaseSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/purchase-summary${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock${q}`);
  return parseJsonOrThrow(r);
}

export async function getCustomerLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/customer-ledger${q}`);
  return parseJsonOrThrow(r);
}

export async function getCustomerBalance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/customer-balance${q}`);
  return parseJsonOrThrow(r);
}

export async function getVendorBalance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-balance${q}`);
  return parseJsonOrThrow(r);
}

export async function getSaleInvoiceReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-invoice${q}`);
  return parseJsonOrThrow(r);
}

export async function getPurchaseInvoiceReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/purchase-invoice${q}`);
  return parseJsonOrThrow(r);
}

export async function getExpenseReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/expense-report${q}`);
  return parseJsonOrThrow(r);
}

export async function getAccountLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/account-ledger${q}`);
  return parseJsonOrThrow(r);
}

export async function getCreditNoteReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/credit-note-report${q}`);
  return parseJsonOrThrow(r);
}

export async function getDebitNoteReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/debit-note-report${q}`);
  return parseJsonOrThrow(r);
}

export async function getDueInvoiceReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/due-invoice${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockAdjustmentReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-adjustment-report${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockMovementReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-movement-report${q}`);
  return parseJsonOrThrow(r);
}

export async function getSalesByMonth(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-by-month${q}`);
  return parseJsonOrThrow(r);
}

export async function getProductSalesHistory(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/product-sales-history${q}`);
  return parseJsonOrThrow(r);
}

export async function getEmployeeReport(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/employee-report${q}`);
  return parseJsonOrThrow(r);
}

// ── New Sales Reports ────────────────────────────────────────────────────────

export async function getCustLoyalty(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-loyalty${q}`);
  return parseJsonOrThrow(r);
}

export async function getCustBalDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-bal-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getSoUndelivered(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/so-undelivered${q}`);
  return parseJsonOrThrow(r);
}

export async function getCustSalesAnalysis(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-sales-analysis${q}`);
  return parseJsonOrThrow(r);
}

export async function getSalesTarget(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-target${q}`);
  return parseJsonOrThrow(r);
}

export async function getCustRefund(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-refund${q}`);
  return parseJsonOrThrow(r);
}

export async function getProdSalesCat(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-sales-cat${q}`);
  return parseJsonOrThrow(r);
}

export async function getSaleDelivery(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-delivery${q}`);
  return parseJsonOrThrow(r);
}

export async function getSaleReturn(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-return${q}`);
  return parseJsonOrThrow(r);
}

export async function getSaleReturnDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-return-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getSaleInvoiceDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-invoice-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getProdSaleCust(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-sale-cust${q}`);
  return parseJsonOrThrow(r);
}

export async function getSoDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/so-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getSaleOrder(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sale-order${q}`);
  return parseJsonOrThrow(r);
}

export async function getProdProfit(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-profit${q}`);
  return parseJsonOrThrow(r);
}

export async function getLeadFees(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/lead-fees${q}`);
  return parseJsonOrThrow(r);
}

export async function getProdRate(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-rate${q}`);
  return parseJsonOrThrow(r);
}

export async function getInvoiceReturnSp(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/invoice-return-sp${q}`);
  return parseJsonOrThrow(r);
}

export async function getSalesPerfSp(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sales-perf-sp${q}`);
  return parseJsonOrThrow(r);
}

export async function getCustLedgerBulk(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/cust-ledger-bulk${q}`);
  return parseJsonOrThrow(r);
}

export async function getDiscountSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/discount-summary${q}`);
  return parseJsonOrThrow(r);
}

export async function getSiDetailUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/si-detail-ug${q}`);
  return parseJsonOrThrow(r);
}

export async function getSrDetailUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/sr-detail-ug${q}`);
  return parseJsonOrThrow(r);
}

export async function getInvoiceProfit(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/invoice-profit${q}`);
  return parseJsonOrThrow(r);
}

export async function getNegPayment(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/neg-payment${q}`);
  return parseJsonOrThrow(r);
}

export async function getNegPaymentDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/neg-payment-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getNegPaymentUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/neg-payment-ug${q}`);
  return parseJsonOrThrow(r);
}

export async function getDistMargin(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/dist-margin${q}`);
  return parseJsonOrThrow(r);
}

// ── Purchase Reports ─────────────────────────────────────────────────────────

export async function getVendorPayment(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-payment${q}`);
  return parseJsonOrThrow(r);
}

export async function getVendorRefund(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-refund${q}`);
  return parseJsonOrThrow(r);
}

export async function getVendorWiseProd(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/vendor-wise-prod${q}`);
  return parseJsonOrThrow(r);
}

export async function getGoodReceiving(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/good-receiving${q}`);
  return parseJsonOrThrow(r);
}

export async function getPurchaseReturn(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/purchase-return${q}`);
  return parseJsonOrThrow(r);
}

export async function getPiDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/pi-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getPoDetailUg(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/po-detail-ug${q}`);
  return parseJsonOrThrow(r);
}

export async function getPiDetail2(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/pi-detail-2${q}`);
  return parseJsonOrThrow(r);
}

export async function getPoPending(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/po-pending${q}`);
  return parseJsonOrThrow(r);
}

// ── Inventory Reports ────────────────────────────────────────────────────────

export async function getWhLocationStock(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/wh-location-stock${q}`);
  return parseJsonOrThrow(r);
}

export async function getLowInventory(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/low-inventory${q}`);
  return parseJsonOrThrow(r);
}

export async function getProdCategory(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/prod-category${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockOnHandVal(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-on-hand-val${q}`);
  return parseJsonOrThrow(r);
}

export async function getShortExpiry(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/short-expiry${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockTracking(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-tracking${q}`);
  return parseJsonOrThrow(r);
}

export async function getNegativeStock(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/negative-stock${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockValuation(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-valuation${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockDiscrepancy(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-discrepancy${q}`);
  return parseJsonOrThrow(r);
}

export async function getBatchWiseStock(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/batch-wise-stock${q}`);
  return parseJsonOrThrow(r);
}

export async function getTransferDisc(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/transfer-disc${q}`);
  return parseJsonOrThrow(r);
}

export async function getTransferOut(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/transfer-out${q}`);
  return parseJsonOrThrow(r);
}

export async function getTransferIn(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/transfer-in${q}`);
  return parseJsonOrThrow(r);
}

export async function getInTransit(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/in-transit${q}`);
  return parseJsonOrThrow(r);
}

export async function getStockOnHandHist(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/stock-on-hand-hist${q}`);
  return parseJsonOrThrow(r);
}

// ── Accounts Reports ─────────────────────────────────────────────────────────

export async function getCourierLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/courier-ledger${q}`);
  return parseJsonOrThrow(r);
}

export async function getOtherContactLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/other-contact-ledger${q}`);
  return parseJsonOrThrow(r);
}

export async function getOcTransactions(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/oc-transactions${q}`);
  return parseJsonOrThrow(r);
}

export async function getConsolidatedLedger(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/consolidated-ledger${q}`);
  return parseJsonOrThrow(r);
}

export async function getTxnList(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/txn-list${q}`);
  return parseJsonOrThrow(r);
}

export async function getTaxCollected(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/tax-collected${q}`);
  return parseJsonOrThrow(r);
}

export async function getTaxPaid(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/tax-paid${q}`);
  return parseJsonOrThrow(r);
}

export async function getTrialSixCol(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/trial-six-col${q}`);
  return parseJsonOrThrow(r);
}

export async function getOtherCollection(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/other-collection${q}`);
  return parseJsonOrThrow(r);
}

export async function getOtherPaymentRpt(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/other-payment-rpt${q}`);
  return parseJsonOrThrow(r);
}

// ── Business Overview Reports ────────────────────────────────────────────────

export async function getBalanceSheet(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/balance-sheet${q}`);
  return parseJsonOrThrow(r);
}

export async function getBusinessSummary(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/business-summary${q}`);
  return parseJsonOrThrow(r);
}

export async function getAuditLog(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/audit-log${q}`);
  return parseJsonOrThrow(r);
}

// ── CRM Reports ──────────────────────────────────────────────────────────────

export async function getCallEngagement(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/call-engagement${q}`);
  return parseJsonOrThrow(r);
}

export async function getLeadsCrm(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/leads-crm${q}`);
  return parseJsonOrThrow(r);
}

export async function getLeadsDetail(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/leads-detail${q}`);
  return parseJsonOrThrow(r);
}

export async function getLeadStatus(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/lead-status${q}`);
  return parseJsonOrThrow(r);
}

// ── Manufacturing Reports ────────────────────────────────────────────────────

export async function getMaterialIssuance(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/material-issuance${q}`);
  return parseJsonOrThrow(r);
}

export async function getJoExpense(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/jo-expense${q}`);
  return parseJsonOrThrow(r);
}

export async function getJoProduction(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/jo-production${q}`);
  return parseJsonOrThrow(r);
}

export async function getJoValidation(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(`${BASE}/jo-validation${q}`);
  return parseJsonOrThrow(r);
}


