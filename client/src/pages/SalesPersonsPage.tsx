import { apiFetch } from '../api/apiFetch';
import { useEffect, useState, useRef } from 'react';
import SalesPersonForm from '../components/SalesPersonForm';
import type { SalesPerson, SalesPersonFilters } from '../types/salesperson';

const SVG = {
  edit: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

export default function SalesPersonsPage() {
  const [persons, setPersons] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [editingSalesPerson, setEditingSalesPerson] = useState<SalesPerson | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<SalesPersonFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<SalesPersonFilters>({});

  // Sorting
  const [sortField, setSortField] = useState<'print_name' | 'status' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (appliedFilters.print_name) p.set('search', appliedFilters.print_name);
      if (appliedFilters.status) p.set('status', appliedFilters.status);
      if (appliedFilters.type) p.set('type', appliedFilters.type);

      const r = await apiFetch('/api/sales-persons?' + p);
      if (!r.ok) throw new Error('Failed to load');
      let data = await r.json();

      // Client-side sorting
      if (sortField === 'print_name') {
        data.sort((a: SalesPerson, b: SalesPerson) => {
          const cmp = a.print_name.localeCompare(b.print_name);
          return sortDir === 'asc' ? cmp : -cmp;
        });
      } else if (sortField === 'status') {
        data.sort((a: SalesPerson, b: SalesPerson) => {
          const cmp = (a.status || '').localeCompare(b.status || '');
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }

      setPersons(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [appliedFilters, sortField, sortDir]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      const r = await fetch(`/api/sales-persons/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSort = (field: 'print_name' | 'status') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'print_name' | 'status' }) => {
    if (sortField !== field) return <span className="text-gray-400 ml-1">↑↓</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const appliedCount = Object.values(appliedFilters).filter(Boolean).length;

  function handlePrint() {
    const headers = ['Name', 'Status', 'Application User Email', 'Branch'];
    const rows = persons.map(p => [p.print_name, p.status ?? '', p.application_user_email ?? '', p.branch_name ?? '']);
    const w = window.open('', '_blank', 'width=900,height=600');
    if (!w) return;
    const body = rows.map(r =>
      `<tr>${r.map(c => `<td style="padding:6px 12px;border-bottom:1px solid #eee">${c}</td>`).join('')}</tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Sales Persons</title>
      <style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:16px}
      table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:13px}
      td{font-size:13px}@media print{body{padding:0}}</style></head>
      <body><h1>Sales Persons</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  function handleExport() {
    const headers = ['Name', 'Status', 'Application User Email', 'Branch'];
    const rows = persons.map(p => [p.print_name, p.status ?? '', p.application_user_email ?? '', p.branch_name ?? '']);
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sales-persons.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (showForm) return (
        <SalesPersonForm
      salesPerson={editingSalesPerson}
      onClose={() => setShowForm(false)}
      onSaved={() => {
        setShowForm(false);
        load();
      }}
      onRefresh={load}
    />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title with ADD SALES PERSON button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Person</h1>
        <button
          onClick={() => {
            setEditingSalesPerson(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors"
        >
          + ADD SALES PERSON
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Row 2: Action buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            setPendingFilters(appliedFilters);
            setShowFilters(true);
          }}
          className="relative inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" /></svg>
          FILTERS
          {appliedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {appliedCount}
            </span>
          )}
        </button>
        <button onClick={handlePrint} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          PRINT
        </button>
        <button onClick={handleExport} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          EXPORT TO EXCEL
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('print_name')}>
                Name <SortIcon field="print_name" />
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Application User Email</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Branch</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {persons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-orange-500 font-medium">
                  No record found
                </td>
              </tr>
            )}
            {persons.map(p => (
              <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 text-blue-600 font-medium cursor-pointer hover:underline">{p.print_name}</td>
                <td className="px-6 py-3 text-gray-700 capitalize">{p.status}</td>
                <td className="px-6 py-3 text-gray-700">{p.application_user_email || '—'}</td>
                <td className="px-6 py-3 text-gray-700">{p.branch_name || '—'}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingSalesPerson(p);
                        setShowForm(true);
                      }}
                      className="text-gray-600 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      {SVG.edit}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      {SVG.trash}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FILTERS MODAL */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/20" onClick={() => setShowFilters(false)} />

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Search by name"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.print_name || ''}
                  onChange={e =>
                    setPendingFilters(f => ({ ...f, print_name: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.status || ''}
                  onChange={e =>
                    setPendingFilters(f => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.type || ''}
                  onChange={e =>
                    setPendingFilters(f => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="salesman">Salesman</option>
                  <option value="order_booker">Order Booker</option>
                  <option value="delivery_person">Delivery Person</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-white rounded-b-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPendingFilters({});
                  setAppliedFilters({});
                  setShowFilters(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppliedFilters(pendingFilters);
                  setShowFilters(false);
                }}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium text-sm transition-colors"
              >
                APPLY
              </button>
              <button
                type="button"
                onClick={() => {
                  // Save filter logic would go here
                  setShowFilters(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                SAVE FILTER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Slide-over */}
    </div>
  );
}

