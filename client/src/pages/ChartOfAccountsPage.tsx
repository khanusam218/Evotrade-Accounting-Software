import { useCallback, useEffect, useState } from 'react';
import AccountForm from '../components/AccountForm';
import { deleteAccount, getAccounts } from '../api/accounts';
import type { Account, AccountType } from '../types/account';

// ── Tree types ─────────────────────────────────────────────────────────────────
interface AccountNode extends Account {
  children: AccountNode[];
  subtotalBalance: number;
}

function buildTree(accounts: Account[]): AccountNode[] {
  const map = new Map<number, AccountNode>();
  accounts.forEach((a) =>
    map.set(a.id, { ...a, children: [], subtotalBalance: Number(a.current_balance) || 0 })
  );
  const roots: AccountNode[] = [];
  accounts.forEach((a) => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  function computeSubtotal(node: AccountNode): number {
    const own = Number(node.current_balance) || 0;
    if (node.children.length === 0) { node.subtotalBalance = own; return own; }
    const total = node.children.reduce((s, c) => s + computeSubtotal(c), own);
    node.subtotalBalance = total;
    return total;
  }
  roots.forEach(computeSubtotal);
  roots.sort((a, b) => a.code.localeCompare(b.code));
  return roots;
}

function pruneByType(nodes: AccountNode[], types: AccountType[]): AccountNode[] {
  if (types.length === 0) return nodes;
  return nodes.flatMap((node) => {
    const prunedChildren = pruneByType(node.children, types);
    if (prunedChildren.length > 0) return [{ ...node, children: prunedChildren }];
    if (types.includes(node.account_type as AccountType)) return [node];
    return [];
  });
}

function filterTree(nodes: AccountNode[], search: string): AccountNode[] {
  if (!search.trim()) return nodes;
  const q = search.toLowerCase();
  return nodes.flatMap((node) => {
    const self =
      node.name.toLowerCase().includes(q) ||
      node.code.toLowerCase().includes(q) ||
      (node.system_name ?? '').toLowerCase().includes(q);
    if (self) return [node];
    const kids = filterTree(node.children, search);
    if (kids.length > 0) return [{ ...node, children: kids }];
    return [];
  });
}

function flattenTree(nodes: AccountNode[], depth = 0): Array<{ node: AccountNode; depth: number }> {
  const result: Array<{ node: AccountNode; depth: number }> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    result.push(...flattenTree(node.children, depth + 1));
  }
  return result;
}

function formatBal(n: number | string): string {
  return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS: { key: string; label: string; types: AccountType[] }[] = [
  { key: 'all',         label: 'All',         types: [] },
  { key: 'assets',      label: 'Assets',      types: ['asset', 'contra_asset'] },
  { key: 'equity',      label: 'Equity',      types: ['equity'] },
  { key: 'expenses',    label: 'Expenses',    types: ['expense'] },
  { key: 'liabilities', label: 'Liabilities', types: ['liability'] },
  { key: 'revenue',     label: 'Revenue',     types: ['revenue', 'contra_revenue'] },
];

function printAccounts(items: Array<{ node: AccountNode; depth: number }>) {
  const win = window.open('', '_blank', 'width=1000,height=680');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Chart of Accounts</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}
table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Chart of Accounts</span></div><hr/>
<table><thead><tr><th>Code</th><th>Name</th><th>System Name</th><th class="r">Balance</th></tr></thead><tbody>
${items.map(({ node }) => `<tr><td>${node.code}</td><td>${node.name}</td><td>${node.system_name ?? ''}</td><td class="r">${formatBal(node.current_balance)}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
}

function exportAccountsToExcel(items: Array<{ node: AccountNode; depth: number }>) {
  const esc = (v: string | null | undefined) => { const s = v ?? ''; return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [['Code', 'Name', 'System Name', 'Balance'].join(','), ...items.map(({ node }) => [esc(node.code), esc(node.name), esc(node.system_name), formatBal(node.current_balance)].join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = 'ChartOfAccounts.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChartOfAccountsPage() {
  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [showInActive, setShowInActive] = useState(false);
  const [activeTab, setActiveTab]     = useState('all');
  const [showForm, setShowForm]       = useState(false);
  const [formKey, setFormKey]         = useState(0);
  const [editTarget, setEditTarget]   = useState<Account | null>(null);
  const [defaultParent, setDefaultParent] = useState<Account | null>(null);
  const [deletingId, setDeletingId]   = useState<number | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true); setError(null);
    try { setAccounts(await getAccounts()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load accounts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  function openAdd() {
    setEditTarget(null); setDefaultParent(null);
    setFormKey((k) => k + 1); setShowForm(true);
  }
  function openAddChild(parent: Account) {
    setEditTarget(null); setDefaultParent(parent);
    setFormKey((k) => k + 1); setShowForm(true);
  }
  function openEdit(acct: Account) {
    setEditTarget(acct); setDefaultParent(null);
    setFormKey((k) => k + 1); setShowForm(true);
  }

  async function handleDelete(acct: Account) {
    if (!window.confirm(`Delete "${acct.name}"? This cannot be undone.`)) return;
    setDeletingId(acct.id);
    try { await deleteAccount(acct.id); fetchAccounts(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Could not delete'); }
    finally { setDeletingId(null); }
  }

  function handleFormSaved(saved: Account, addNew: boolean) {
    fetchAccounts();
    if (addNew) {
      setEditTarget(null); setDefaultParent(null); setFormKey((k) => k + 1);
    } else {
      setShowForm(false); setEditTarget(null);
    }
  }

  // ── Early return: show form instead of list ──────────────────────────────────
  if (showForm) return (
    <AccountForm
      key={formKey}
      account={editTarget}
      defaultParent={defaultParent}
      onClose={() => { setShowForm(false); setEditTarget(null); }}
      onSaved={handleFormSaved}
    />
  );

  // ── Build display tree ───────────────────────────────────────────────────────
  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const activeAccounts = accounts.filter((a) => showInActive || a.is_active);
  const fullTree  = buildTree(activeAccounts);
  const tabTree   = pruneByType(fullTree, tab.types);
  const flatItems = flattenTree(filterTree(tabTree, search));

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD ACCOUNT
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-white border-b border-gray-100 px-6 py-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showInActive}
            onChange={(e) => setShowInActive(e.target.checked)}
            className="accent-blue-600 w-4 h-4" />
          Show In Active
        </label>

        <div className="flex flex-col flex-1 max-w-sm">
          <span className="text-xs text-gray-500 mb-1 text-center">Search</span>
          <input type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name or system name…"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div className="flex-1" />

        <button
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600"
          onClick={() => printAccounts(flatItems)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PRINT
        </button>

        <button
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600"
          onClick={() => exportAccountsToExcel(flatItems)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
          </svg>
          EXPORT TO EXCEL
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-end bg-white border-b border-gray-200 px-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 mr-1 transition-colors ${
              activeTab === t.key
                ? 'border-green-500 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white">
        {error && (
          <div className="mx-6 mt-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 w-36">Code</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 w-48">System Name</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 w-32">Balance</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 w-44">Action</th>
              </tr>
            </thead>
            <tbody>
              {flatItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-orange-500 font-medium">
                    No record found
                  </td>
                </tr>
              ) : (
                flatItems.map(({ node, depth }) => {
                  const isGroup = node.account_group === 'control' || node.children.length > 0;

                  // ── Root-level section header (Assets / Liabilities / Equity …)
                  if (isGroup && depth === 0) {
                    return (
                      <tr key={`grp-${node.id}`} className="border-b border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-900 text-sm">
                          {node.name}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900 text-sm whitespace-nowrap">
                          {formatBal(node.subtotalBalance)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => openAddChild(node)}
                            className="flex items-center gap-1 text-green-600 text-xs font-medium hover:text-green-700 ml-auto whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                            </svg>
                            Add a new account
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // ── Sub-group header (Current Assets / Cash / Bank …)
                  if (isGroup) {
                    const indent = depth * 16 + 16;
                    return (
                      <tr key={`grp-${node.id}`} className="border-b border-gray-100">
                        <td colSpan={3} className="px-4 py-2 font-semibold text-gray-800 text-sm"
                          style={{ paddingLeft: indent }}>
                          {node.name}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800 text-sm whitespace-nowrap">
                          {formatBal(node.subtotalBalance)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => openAddChild(node)}
                            className="flex items-center gap-1 text-green-600 text-xs font-medium hover:text-green-700 ml-auto whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                            </svg>
                            Add a new account
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // ── Leaf account row
                  const indent = depth * 16 + 16;
                  return (
                    <tr key={`leaf-${node.id}`} className="border-b border-gray-100 hover:bg-gray-50 group">
                      <td className="px-4 py-2 text-sm text-gray-700" style={{ paddingLeft: indent }}>
                        {node.code}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {node.name}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-orange-500">
                        {node.system_name ?? ''}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700 whitespace-nowrap">
                        {formatBal(node.current_balance)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Duplicate"
                            className="p-1 text-gray-400 hover:text-gray-600 rounded">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button onClick={() => openEdit(node)} title="Edit"
                            className="p-1 text-gray-400 hover:text-blue-600 rounded">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {!node.is_system && (
                            <button onClick={() => handleDelete(node)} disabled={deletingId === node.id}
                              title="Delete"
                              className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
