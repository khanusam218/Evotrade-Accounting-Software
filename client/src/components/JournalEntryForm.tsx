import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { Account } from '../types/account';
import type { JournalEntry, JournalEntryLine } from '../types/journalEntry';
import { getAccountsLookup } from '../api/accounts';
import { createJournalEntry, updateJournalEntry } from '../api/journalEntries';
import { getCustomers } from '../api/customers';
import { getVendors } from '../api/vendors';

interface Props {
  entry: JournalEntry | null;
  onClose: () => void;
  onSaved: (entry: JournalEntry, continueEdit: boolean) => void;
}

interface ContactOption { id: number; label: string; }

function emptyLine(): JournalEntryLine {
  return { account_id: '', description: '', debit: '', credit: '' };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JournalEntryForm({ entry, onClose, onSaved }: Props) {
  const isEdit = entry !== null;

  const [date,        setDate]        = useState(isEdit ? entry.date.slice(0, 10) : today());
  const [memo,        setMemo]        = useState(isEdit ? entry.memo : '');
  const [reference,   setReference]   = useState(isEdit ? (entry.reference ?? '') : '');
  const [lines,       setLines]       = useState<JournalEntryLine[]>(
    isEdit && entry.lines?.length ? entry.lines : [emptyLine(), emptyLine()]
  );
  // parallel array: contact per line (customer or vendor id)
  const [lineContacts, setLineContacts] = useState<(number | '')[]>(
    (isEdit && entry.lines?.length ? entry.lines : [emptyLine(), emptyLine()]).map(() => '')
  );
  const [nextNumber,  setNextNumber]  = useState('');
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [contacts,    setContacts]    = useState<ContactOption[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragOver,    setDragOver]    = useState(false);

  useEffect(() => {
    getAccountsLookup().then(setAccounts).catch(() => {});
    Promise.all([
      getCustomers({ page: 1, limit: 1000 }).catch(() => ({ data: [] as { id: number; name: string }[] })),
      getVendors({   page: 1, limit: 1000 }).catch(() => ({ data: [] as { id: number; name: string }[] })),
    ]).then(([cRes, vRes]) => {
      const cData = (cRes as { data: { id: number; name: string }[] }).data ?? [];
      const vData = (vRes as { data: { id: number; name: string }[] }).data ?? [];
      setContacts([
        ...cData.map(c => ({ id: c.id, label: c.name })),
        ...vData.map(v => ({ id: v.id, label: v.name })),
      ]);
    });
    if (!isEdit) {
      apiFetch('/api/journal-entries/next-number')
        .then(r => r.json())
        .then((d: { number: string }) => setNextNumber(d.number))
        .catch(() => {});
    }
  }, [isEdit]);

  function updateLine<K extends keyof JournalEntryLine>(idx: number, key: K, val: JournalEntryLine[K]) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  }

  function setLineContact(idx: number, val: number | '') {
    setLineContacts(prev => prev.map((c, i) => i === idx ? val : c));
  }

  function addLine() {
    setLines(prev => [...prev, emptyLine()]);
    setLineContacts(prev => [...prev, '']);
  }

  function removeLine(idx: number) {
    if (lines.length > 1) {
      setLines(prev => prev.filter((_, i) => i !== idx));
      setLineContacts(prev => prev.filter((_, i) => i !== idx));
    } else {
      setLines([emptyLine(), emptyLine()]);
      setLineContacts(['', '']);
    }
  }

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(String(l.debit))  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(String(l.credit)) || 0), 0);
  const difference  = Math.abs(totalDebit - totalCredit);
  const balanced    = difference < 0.005;

  function refreshNextNumber() {
    if (isEdit) return;
    apiFetch('/api/journal-entries/next-number')
      .then(r => r.json())
      .then((d: { number: string }) => setNextNumber(d.number))
      .catch(() => {});
  }

  async function handleSave(continueEdit = false) {
    if (!date)        { setError('Date is required'); return; }
    if (!memo.trim()) { setError('Memo is required'); return; }
    const validLines = lines.filter(l => l.account_id);
    if (!validLines.length) { setError('At least one line with an account is required'); return; }

    setSaving(true); setError('');
    try {
      const payload = {
        date, memo: memo.trim(), reference: reference.trim(),
        lines: validLines.map(l => ({
          ...l,
          account_id: Number(l.account_id),
          debit:  parseFloat(String(l.debit))  || 0,
          credit: parseFloat(String(l.credit)) || 0,
        })),
      };
      const saved = isEdit
        ? await updateJournalEntry(entry.id, payload)
        : await createJournalEntry(payload);
      onSaved(saved, continueEdit);
      if (!continueEdit) onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setAttachments(prev => [...prev, ...files]);
  }

  const displayNumber = isEdit ? entry.number : (nextNumber || 'JE-000001');
  const statusLabel   = isEdit ? entry.status.toUpperCase() : 'DRAFT';

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Journal Entries - [{displayNumber}]
          </h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">{statusLabel}</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Row 1: Number | Date | Reference */}
          <div className="grid grid-cols-3 gap-4">
            {/* Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button type="button"
                  className="h-9 px-2.5 bg-green-500 text-white rounded text-sm font-bold hover:bg-green-600 flex-shrink-0">
                  ▼
                </button>
                <input type="text" disabled value={displayNumber}
                  className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-gray-700 min-w-0" />
                <button type="button" onClick={refreshNextNumber}
                  className="h-9 w-9 flex items-center justify-center bg-green-500 text-white rounded hover:bg-green-600 flex-shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 min-w-0" />
                <button type="button" onClick={() => setDate('')}
                  className="h-9 w-7 flex items-center justify-center text-gray-500 hover:text-red-500 text-lg leading-none flex-shrink-0">
                  ×
                </button>
                <button type="button"
                  className="h-9 w-9 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-gray-50 flex-shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input type="text" placeholder="Reference" value={reference}
                onChange={e => setReference(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
            </div>
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-white">
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Account</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700 w-28">Debit</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700 w-28">Credit</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700 w-56">Contact</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {/* Account — red border when empty */}
                    <td className="px-3 py-2">
                      <select
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        style={{ borderColor: line.account_id ? '#d1d5db' : '#f87171' }}
                        value={line.account_id}
                        onChange={e => updateLine(idx, 'account_id', e.target.value === '' ? '' : Number(e.target.value))}>
                        <option value="">Type to search account</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </td>
                    {/* Description — auto-expands like Splendid */}
                    <td className="px-3 py-2">
                      <textarea
                        placeholder="Description"
                        rows={1}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none overflow-hidden"
                        style={{ minHeight: '2rem' }}
                        value={line.description}
                        onChange={e => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                          updateLine(idx, 'description', e.target.value);
                        }}
                        onFocus={e => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                      />
                    </td>
                    {/* Debit */}
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={line.debit === '' ? 0 : line.debit}
                        onChange={e => {
                          updateLine(idx, 'debit', e.target.value === '' ? '' : parseFloat(e.target.value) || 0);
                          if (e.target.value) updateLine(idx, 'credit', 0);
                        }} />
                    </td>
                    {/* Credit */}
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={line.credit === '' ? 0 : line.credit}
                        onChange={e => {
                          updateLine(idx, 'credit', e.target.value === '' ? '' : parseFloat(e.target.value) || 0);
                          if (e.target.value) updateLine(idx, 'debit', 0);
                        }} />
                    </td>
                    {/* Contact — customers + vendors */}
                    <td className="px-3 py-2">
                      <select
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={lineContacts[idx] ?? ''}
                        onChange={e => setLineContact(idx, e.target.value === '' ? '' : Number(e.target.value))}>
                        <option value="">Type to search contact</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    {/* Action */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={addLine}
                          className="text-green-600 hover:text-green-800 font-bold text-xl leading-none" title="Add line">
                          ✓
                        </button>
                        <button type="button" onClick={() => removeLine(idx)}
                          className="text-red-400 hover:text-red-600 font-bold text-xl leading-none" title="Remove line">
                          ✗
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-gray-700">TOTAL (PKR)</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm text-gray-800">{fmt(totalDebit)}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm text-gray-800">{fmt(totalCredit)}</td>
                  <td colSpan={2} />
                </tr>
                {!balanced && (totalDebit > 0 || totalCredit > 0) && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-center text-xs text-red-600 font-medium">
                      Out of balance by {fmt(difference)} — Debits must equal Credits before posting
                    </td>
                  </tr>
                )}
                {balanced && totalDebit > 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-center text-xs text-green-600 font-medium">
                      ✓ Balanced
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Memo textarea */}
          <textarea
            rows={3}
            placeholder="Memo"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-y"
          />

          {/* Attachments */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Attachments</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex items-center justify-center gap-4 border-2 border-dashed rounded-lg px-6 py-6 transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}`}>
              {attachments.length > 0 ? (
                <span className="text-sm text-gray-600">{attachments.map(f => f.name).join(', ')}</span>
              ) : (
                <>
                  <span className="text-sm text-gray-400">Drop files here or</span>
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded">
                    BROWSE FILES
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer — SAVE AND NEW (gray split) | × CLOSE (yellow) */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white rounded-b">
          <div className="flex items-stretch rounded overflow-hidden border border-gray-300">
            <button type="button" onClick={() => handleSave(false)} disabled={saving}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <div className="w-px bg-gray-300" />
            <button type="button" disabled={saving}
              className="flex items-center px-2 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
            <span className="text-base leading-none">×</span>
            CLOSE
          </button>
        </div>
    </div>
  );
}
