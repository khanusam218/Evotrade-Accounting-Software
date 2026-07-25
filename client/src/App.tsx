import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CustomersPage          from './pages/CustomersPage';
import VendorsPage            from './pages/VendorsPage';
import ProductsPage           from './pages/ProductsPage';
import ChartOfAccountsPage    from './pages/ChartOfAccountsPage';
import JournalEntriesPage     from './pages/JournalEntriesPage';
import BankAccountsPage       from './pages/BankAccountsPage';
import ExpensesPage           from './pages/ExpensesPage';
import FundTransfersPage      from './pages/FundTransfersPage';
import BankDepositsPage       from './pages/BankDepositsPage';
import CreditNotesPage        from './pages/CreditNotesPage';
import DebitNotesPage         from './pages/DebitNotesPage';
import OtherCollectionsPage   from './pages/OtherCollectionsPage';
import OtherPaymentsPage      from './pages/OtherPaymentsPage';
import InstrumentsPage        from './pages/InstrumentsPage';
import OCSPage                from './pages/OCSPage';
import SalesQuotationsPage    from './pages/SalesQuotationsPage';
import SalesOrdersPage        from './pages/SalesOrdersPage';
import SalesInvoicesPage      from './pages/SalesInvoicesPage';
import ReceivePaymentsPage    from './pages/ReceivePaymentsPage';
import SalesReturnsPage       from './pages/SalesReturnsPage';
import SalesRefundsPage       from './pages/SalesRefundsPage';
import SalesSettlementsPage   from './pages/SalesSettlementsPage';
import RecurringInvoicesPage  from './pages/RecurringInvoicesPage';
import PurchaseOrdersPage     from './pages/PurchaseOrdersPage';
import PurchaseInvoicesPage   from './pages/PurchaseInvoicesPage';
import MakePaymentsPage       from './pages/MakePaymentsPage';
import PurchaseReturnsPage    from './pages/PurchaseReturnsPage';
import PurchaseRefundsPage    from './pages/PurchaseRefundsPage';
import PurchaseSettlementsPage from './pages/PurchaseSettlementsPage';
import WarehousesPage         from './pages/WarehousesPage';
import StockAdjustmentsPage   from './pages/StockAdjustmentsPage';
import StockMovementsPage          from './pages/StockMovementsPage';
import StockAuditPage              from './pages/StockAuditPage';
import ScheduledValuationsPage     from './pages/ScheduledValuationsPage';
import SalesDeliveriesPage    from './pages/SalesDeliveriesPage';
import ImportInvoicesPage     from './pages/ImportInvoicesPage';
import SetupPage              from './pages/SetupPage';
import CrmPage                from './pages/CrmPage';
import CrmTicketsPage         from './pages/CrmTicketsPage';
import CrmEventsPage          from './pages/CrmEventsPage';
import CrmCallsPage           from './pages/CrmCallsPage';
import OtherContactsPage      from './pages/OtherContactsPage';
import ProspectsPage          from './pages/ProspectsPage';
import CouriersPage           from './pages/CouriersPage';
import SalesPersonsPage       from './pages/SalesPersonsPage';
import SettingsPage           from './pages/SettingsPage';
import ManufacturingPage      from './pages/ManufacturingPage';
import DisassemblyPage        from './pages/DisassemblyPage';
import PayrollPage            from './pages/PayrollPage';
import POSPage                from './pages/POSPage';
import POSCountersPage        from './pages/POSCountersPage';
import DeliveryCounterPage    from './pages/DeliveryCounterPage';
import BarcodeTemplatesPage   from './pages/BarcodeTemplatesPage';
import POSDailySummaryPage    from './pages/POSDailySummaryPage';
import DashboardPage          from './pages/DashboardPage';
import ReportsPage            from './pages/ReportsPage';
import LoginPage              from './pages/LoginPage';

// ─── Sidebar primitives ───────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Top-level icon link (Dashboard, Reports, Setup) */
function TopLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive ? 'text-green-600 font-semibold' : 'text-gray-700 hover:text-green-600'
      }`
    }>
      <span className={`h-4 w-4 shrink-0`}>{icon}</span>
      {label}
    </NavLink>
  );
}

/** Sub-item inside a collapsible section */
function SubLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end className={({ isActive }) =>
      `block px-3 py-1.5 text-sm transition-colors ${
        isActive
          ? 'text-green-600 font-semibold'
          : 'text-gray-600 hover:text-green-600'
      }`
    }>
      {label}
    </NavLink>
  );
}

/** Collapsible section with auto-open when any child path is active */
function Section({ icon, label, paths, children }: {
  icon: React.ReactNode;
  label: string;
  paths: string[];
  children: React.ReactNode;
}) {
  const location = useLocation();
  const active = paths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
  const [open, setOpen] = useState(active);

  useEffect(() => { if (active) setOpen(true); }, [location.pathname]);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active ? 'text-green-600' : 'text-gray-700 hover:text-green-600'
        }`}
      >
        <span className={`h-4 w-4 shrink-0 ${active ? 'text-green-600' : 'text-gray-400'}`}>{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Icons (inline SVG helpers) ───────────────────────────────────────────────

const I = {
  home:    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  chart:   <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>,
  crm:     <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  sales:   <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
  purchase:<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  pos:     <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  inv:     <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  acc:     <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  mfg:     <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  hr:      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  masters: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  setup:   <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
  reports: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>,
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const navigate = useNavigate();

  let activeBiz: { name: string; type: string; initials: string; color: string } | null = null;
  try { activeBiz = JSON.parse(localStorage.getItem('evotrade_active_business') || ''); } catch {}

  function switchBusiness() {
    localStorage.removeItem('evotrade_active_business');
    navigate('/login');
  }

  function logout() {
    // Fully end the session so logging back in requires the ID & password again.
    localStorage.removeItem('evotrade_active_business');
    localStorage.removeItem('evotrade_authed');
    navigate('/login');
  }

  return (
    <aside className="w-56 h-screen sticky top-0 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Business brand header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
          style={{ backgroundColor: activeBiz?.color || '#2563eb' }}
        >
          {activeBiz?.initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900 truncate leading-tight">
            {activeBiz?.name || 'My Business'}
          </div>
          <div className="text-xs text-gray-400 truncate">{activeBiz?.type || ''}</div>
        </div>
        <button
          onClick={logout}
          title="Back to Login"
          className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto text-sm">

        {/* ── Home / Dashboard / Reports ── */}
        <TopLink to="/dashboard" label="Dashboard" icon={I.home} />
        <TopLink to="/reports"   label="Reports"   icon={I.reports} />

        <div className="pt-2 pb-1 px-3">
          <div className="h-px bg-gray-100" />
        </div>

        {/* ── CRM ── */}
        <Section icon={I.crm} label="CRM" paths={['/crm', '/prospects']}>
          <SubLink to="/crm"          label="Lead" />
          <SubLink to="/prospects"    label="Prospects" />
          <SubLink to="/crm/tickets"  label="Ticket" />
          <SubLink to="/crm/events"   label="Event" />
          <SubLink to="/crm/calls"    label="Call" />
        </Section>

        {/* ── Sales ── */}
        <Section icon={I.sales} label="Sales" paths={[
          '/sales-quotations', '/sales-orders', '/sales-invoices', '/receive-payments',
          '/sales-returns', '/sales-refunds', '/sales-settlements',
          '/recurring-invoices', '/sales-deliveries',
        ]}>
          <SubLink to="/sales-quotations"  label="Quotations" />
          <SubLink to="/sales-orders"      label="Sales Orders" />
          <SubLink to="/sales-invoices"    label="Sales Invoices" />
          <SubLink to="/receive-payments"  label="Receive Payments" />
          <SubLink to="/sales-returns"     label="Sales Returns" />
          <SubLink to="/sales-refunds"     label="Refund" />
          <SubLink to="/sales-settlements" label="Settlements" />
          <SubLink to="/sales-deliveries"  label="Sales Deliveries" />
          <SubLink to="/recurring-invoices" label="Recurring Invoices" />
        </Section>

        {/* ── Purchases ── */}
        <Section icon={I.purchase} label="Purchases" paths={[
          '/purchase-quotations', '/purchase-orders', '/purchase-invoices', '/make-payments',
          '/purchase-returns', '/purchase-refunds', '/purchase-settlements',
          '/import-invoices',
        ]}>
          <SubLink to="/purchase-orders"      label="Purchase Orders" />
          <SubLink to="/purchase-invoices"    label="Purchase Invoices" />
          <SubLink to="/make-payments"        label="Make Payments" />
          <SubLink to="/purchase-returns"     label="Purchase Returns" />
          <SubLink to="/purchase-refunds"     label="Refund" />
          <SubLink to="/purchase-settlements" label="Settlements" />
          <SubLink to="/import-invoices"      label="Import Invoices" />
        </Section>

        {/* ── POS ── */}
        <Section icon={I.pos} label="POS" paths={['/pos', '/barcode-templates', '/pos/delivery-counters', '/pos/daily-summary']}>
          <SubLink to="/pos/counters"          label="Checkout Counter" />
          <SubLink to="/pos"                   label="POS Terminal" />
          <SubLink to="/pos/delivery-counters" label="Delivery Counters" />
          <SubLink to="/pos/daily-summary"     label="Daily Summary" />
          <SubLink to="/barcode-templates"     label="Barcode Templates" />
        </Section>

        {/* ── Inventory ── */}
        <Section icon={I.inv} label="Inventory" paths={[
          '/warehouses', '/stock-adjustments', '/stock-movements', '/stock-audits', '/scheduled-valuations',
        ]}>
          <SubLink to="/warehouses"            label="Warehouses" />
          <SubLink to="/stock-adjustments"     label="Stock Adjustments" />
          <SubLink to="/stock-movements"       label="Stock Movements" />
          <SubLink to="/stock-audits"          label="Stock Audit" />
          <SubLink to="/scheduled-valuations"  label="Scheduled Valuations" />
        </Section>

        {/* ── Accounts ── */}
        <Section icon={I.acc} label="Accounts" paths={[
          '/chart-of-accounts', '/journal-entries', '/bank-accounts', '/expenses',
          '/fund-transfers', '/bank-deposits', '/credit-notes', '/debit-notes',
          '/other-collections', '/other-payments',
          '/instruments', '/other-contact-settlements',
        ]}>
          <SubLink to="/chart-of-accounts"        label="Chart of Accounts" />
          <SubLink to="/journal-entries"           label="Journal Entries" />
          <SubLink to="/bank-accounts"             label="Bank Accounts" />
          <SubLink to="/expenses"                  label="Expenses" />
          <SubLink to="/fund-transfers"            label="Fund Transfers" />
          <SubLink to="/bank-deposits"             label="Bank Deposits" />
          <SubLink to="/credit-notes"              label="Credit Notes" />
          <SubLink to="/debit-notes"               label="Debit Notes" />
          <SubLink to="/other-collections"         label="Other Collections" />
          <SubLink to="/other-payments"            label="Other Payments" />
          <SubLink to="/instruments"               label="Instruments" />
          <SubLink to="/other-contact-settlements" label="OC Settlements" />
        </Section>

        {/* ── Manufacturing ── */}
        <Section icon={I.mfg} label="Manufacturing" paths={['/manufacturing', '/disassembly']}>
          <SubLink to="/manufacturing" label="Job Order" />
          <SubLink to="/disassembly"   label="Disassembly" />
        </Section>

        {/* ── HR & Payroll ── */}
        <Section icon={I.hr} label="HR & Payroll" paths={['/payroll']}>
          <SubLink to="/payroll" label="Payroll & HR" />
        </Section>

        {/* ── Masters / Lists ── */}
        <Section icon={I.masters} label="Masters" paths={[
          '/customers', '/vendors', '/products',
          '/sales-persons', '/other-contacts', '/couriers', '/settings',
        ]}>
          <SubLink to="/customers"      label="Customers" />
          <SubLink to="/vendors"        label="Vendors" />
          <SubLink to="/products"       label="Products" />
          <SubLink to="/sales-persons"  label="Sales Persons" />
          <SubLink to="/other-contacts" label="Other Contacts" />
          <SubLink to="/couriers"       label="Couriers" />
          <SubLink to="/settings"       label="Settings" />
        </Section>

        <div className="pt-2 pb-1 px-3">
          <div className="h-px bg-gray-100" />
        </div>

        {/* ── Setup ── */}
        <TopLink to="/setup" label="Setup" icon={I.setup} />

      </nav>

      {/* ── Switch Business ── */}
      <div className="shrink-0 border-t border-gray-200 px-3 py-2">
        <button
          onClick={switchBusiness}
          className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-2 rounded-md transition-colors"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
          Switch Business
        </button>
      </div>
    </aside>
  );
}

// ─── Protected layout (requires an active business) ──────────────────────────

function ProtectedApp() {
  let isLoggedIn = false;
  try { isLoggedIn = !!JSON.parse(localStorage.getItem('evotrade_active_business') || ''); } catch {}
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
            <Route path="/"                          element={<Navigate to="/dashboard" replace />} />

            {/* Top-level */}
            <Route path="/dashboard"                 element={<DashboardPage />} />
            <Route path="/reports"                   element={<ReportsPage />} />

            {/* Masters */}
            <Route path="/customers"                 element={<CustomersPage />} />
            <Route path="/vendors"                   element={<VendorsPage />} />
            <Route path="/products"                  element={<ProductsPage />} />
            <Route path="/sales-persons"             element={<SalesPersonsPage />} />
            <Route path="/other-contacts"            element={<OtherContactsPage />} />
            <Route path="/couriers"                  element={<CouriersPage />} />
            <Route path="/settings"                  element={<SettingsPage />} />

            {/* CRM */}
            <Route path="/crm"                       element={<CrmPage />} />
            <Route path="/crm/tickets"               element={<CrmTicketsPage />} />
            <Route path="/crm/events"                element={<CrmEventsPage />} />
            <Route path="/crm/calls"                 element={<CrmCallsPage />} />
            <Route path="/prospects"                 element={<ProspectsPage />} />

            {/* Accounts */}
            <Route path="/chart-of-accounts"         element={<ChartOfAccountsPage />} />
            <Route path="/journal-entries"           element={<JournalEntriesPage />} />
            <Route path="/bank-accounts"             element={<BankAccountsPage />} />
            <Route path="/expenses"                  element={<ExpensesPage />} />
            <Route path="/fund-transfers"            element={<FundTransfersPage />} />
            <Route path="/bank-deposits"             element={<BankDepositsPage />} />
            <Route path="/credit-notes"              element={<CreditNotesPage />} />
            <Route path="/debit-notes"               element={<DebitNotesPage />} />
            <Route path="/other-collections"         element={<OtherCollectionsPage />} />
            <Route path="/other-payments"            element={<OtherPaymentsPage />} />
            <Route path="/instruments"               element={<InstrumentsPage />} />
            <Route path="/other-contact-settlements" element={<OCSPage />} />

            {/* Sales */}
            <Route path="/sales-quotations"          element={<SalesQuotationsPage />} />
            <Route path="/sales-orders"              element={<SalesOrdersPage />} />
            <Route path="/sales-invoices"            element={<SalesInvoicesPage />} />
            <Route path="/receive-payments"          element={<ReceivePaymentsPage />} />
            <Route path="/sales-returns"             element={<SalesReturnsPage />} />
            <Route path="/sales-refunds"             element={<SalesRefundsPage />} />
            <Route path="/sales-settlements"         element={<SalesSettlementsPage />} />
            <Route path="/recurring-invoices"        element={<RecurringInvoicesPage />} />
            <Route path="/sales-deliveries"          element={<SalesDeliveriesPage />} />

            {/* Purchases */}
            <Route path="/purchase-orders"           element={<PurchaseOrdersPage />} />
            <Route path="/purchase-invoices"         element={<PurchaseInvoicesPage />} />
            <Route path="/make-payments"             element={<MakePaymentsPage />} />
            <Route path="/purchase-returns"          element={<PurchaseReturnsPage />} />
            <Route path="/purchase-refunds"          element={<PurchaseRefundsPage />} />
            <Route path="/purchase-settlements"      element={<PurchaseSettlementsPage />} />
            <Route path="/import-invoices"           element={<ImportInvoicesPage />} />

            {/* Inventory */}
            <Route path="/warehouses"                element={<WarehousesPage />} />
            <Route path="/stock-adjustments"         element={<StockAdjustmentsPage />} />
            <Route path="/stock-movements"           element={<StockMovementsPage />} />
            <Route path="/stock-audits"              element={<StockAuditPage />} />
            <Route path="/scheduled-valuations"      element={<ScheduledValuationsPage />} />

            {/* POS — tab-aware routes */}
            <Route path="/pos"                       element={<POSPage />} />
            <Route path="/pos/counters"              element={<POSCountersPage />} />
            <Route path="/pos/delivery-counters"     element={<DeliveryCounterPage />} />
            <Route path="/pos/daily-summary"         element={<POSDailySummaryPage />} />
            <Route path="/barcode-templates"         element={<BarcodeTemplatesPage />} />

            {/* Manufacturing */}
            <Route path="/manufacturing"             element={<ManufacturingPage />} />
            <Route path="/disassembly"               element={<DisassemblyPage />} />

            {/* HR */}
            <Route path="/payroll"                   element={<PayrollPage />} />

            {/* System */}
            <Route path="/setup"                     element={<SetupPage />} />
          </Routes>
        </main>
      </div>
    );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*"     element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
