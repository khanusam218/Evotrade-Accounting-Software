import { useEffect, useState } from 'react';
import { getDashboard, getSalesChart, getTopCustomers } from '../api/dashboard';

const fmt = (n: number | string) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface KpiCardProps { label: string; value: string; sub?: string; color?: string; }
function KpiCard({ label, value, sub, color = 'bg-white' }: KpiCardProps) {
  return (
    <div className={`${color} rounded-lg shadow p-4`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

interface AgingRowProps { label: string; amount: number; total: number; }
function AgingRow({ label, amount, total }: AgingRowProps) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-gray-500">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 text-right font-medium">{fmt(amount)}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [chart, setChart] = useState<{ month: string; amount: string }[]>([]);
  const [topCust, setTopCust] = useState<{ customer_name: string; total_revenue: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), getSalesChart(), getTopCustomers()])
      .then(([d, c, t]) => { setData(d); setChart(c); setTopCust(t); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard...</div>;
  if (!data)   return <div className="p-8 text-red-500">Failed to load dashboard.</div>;

  const { sales, purchases, ar_aging, ap_aging, stock, open_orders, open_tickets, recent_invoices } = data;

  const chartMax = chart.reduce((m, r) => Math.max(m, Number(r.amount)), 1);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Sales This Month"    value={fmt(sales.sales_this_month)}    color="bg-blue-50" />
        <KpiCard label="Sales YTD"           value={fmt(sales.sales_ytd)}           color="bg-blue-50" />
        <KpiCard label="Purchases This Month" value={fmt(purchases.purchases_this_month)} color="bg-purple-50" />
        <KpiCard label="Purchases YTD"       value={fmt(purchases.purchases_ytd)}   color="bg-purple-50" />
        <KpiCard label="Total A/R"           value={fmt(ar_aging.total_ar)}         color="bg-green-50" />
        <KpiCard label="Total A/P"           value={fmt(ap_aging.total_ap)}         color="bg-red-50" />
        <KpiCard label="Stock Value"         value={fmt(stock.total_stock_value)}   sub={`${stock.total_products} products`} color="bg-yellow-50" />
        <KpiCard label="Open Tickets"        value={String(open_tickets)}           color="bg-orange-50" />
      </div>

      {/* Open orders */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{open_orders.open_sales_orders}</p>
          <p className="text-sm text-gray-500 mt-1">Open Sales Orders</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{open_orders.open_purchase_orders}</p>
          <p className="text-sm text-gray-500 mt-1">Open Purchase Orders</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{open_orders.open_work_orders}</p>
          <p className="text-sm text-gray-500 mt-1">Active Work Orders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A/R Aging */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-3">A/R Aging</h2>
          <div className="space-y-2">
            <AgingRow label="Current"   amount={Number(ar_aging.current_amt)} total={Number(ar_aging.total_ar)} />
            <AgingRow label="1–30 days" amount={Number(ar_aging.days_1_30)}   total={Number(ar_aging.total_ar)} />
            <AgingRow label="31–60 days" amount={Number(ar_aging.days_31_60)} total={Number(ar_aging.total_ar)} />
            <AgingRow label="61–90 days" amount={Number(ar_aging.days_61_90)} total={Number(ar_aging.total_ar)} />
            <AgingRow label="Over 90"   amount={Number(ar_aging.over_90)}     total={Number(ar_aging.total_ar)} />
          </div>
          <p className="text-right text-sm font-semibold mt-3 text-gray-700">Total: {fmt(ar_aging.total_ar)}</p>
        </div>

        {/* A/P Aging */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-3">A/P Aging</h2>
          <div className="space-y-2">
            <AgingRow label="Current"   amount={Number(ap_aging.current_amt)} total={Number(ap_aging.total_ap)} />
            <AgingRow label="1–30 days" amount={Number(ap_aging.days_1_30)}   total={Number(ap_aging.total_ap)} />
            <AgingRow label="31–60 days" amount={Number(ap_aging.days_31_60)} total={Number(ap_aging.total_ap)} />
            <AgingRow label="61–90 days" amount={Number(ap_aging.days_61_90)} total={Number(ap_aging.total_ap)} />
            <AgingRow label="Over 90"   amount={Number(ap_aging.over_90)}     total={Number(ap_aging.total_ap)} />
          </div>
          <p className="text-right text-sm font-semibold mt-3 text-gray-700">Total: {fmt(ap_aging.total_ap)}</p>
        </div>

        {/* Sales Chart */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Monthly Sales (Last 12 Months)</h2>
          {chart.length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
            <div className="flex items-end gap-1 h-32">
              {chart.map(r => (
                <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-indigo-500 rounded-t"
                    style={{ height: `${(Number(r.amount) / chartMax) * 100}%` }}
                    title={`${r.month}: ${fmt(Number(r.amount))}`}
                  />
                  <span className="text-[9px] text-gray-400 rotate-45 origin-left">{r.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top customers */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Top Customers (12 Months)</h2>
          <div className="space-y-1">
            {topCust.slice(0, 8).map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700 truncate">{c.customer_name}</span>
                <span className="font-medium text-gray-800 ml-2 whitespace-nowrap">{fmt(Number(c.total_revenue))}</span>
              </div>
            ))}
            {topCust.length === 0 && <p className="text-sm text-gray-400">No data</p>}
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Recent Sales Invoices</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="text-left pb-2">Number</th>
              <th className="text-left pb-2">Customer</th>
              <th className="text-left pb-2">Date</th>
              <th className="text-right pb-2">Amount</th>
              <th className="text-left pb-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {recent_invoices.map((inv: any) => (
              <tr key={inv.number} className="border-b last:border-0">
                <td className="py-1 font-mono text-xs">{inv.number}</td>
                <td className="py-1">{inv.customer_name}</td>
                <td className="py-1 text-gray-500">{inv.date?.slice(0, 10)}</td>
                <td className="py-1 text-right">{fmt(inv.net_amount)}</td>
                <td className="py-1 pl-3">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
