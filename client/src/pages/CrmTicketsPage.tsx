import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import {
  getCrmTickets, getNextTicketNumber,
  createCrmTicket, updateCrmTicket, deleteCrmTicket,
} from '../api/crmTickets';
import {
  CrmTicket, TicketStatus,
  TICKET_STATUSES, TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, TICKET_PRIORITIES,
} from '../types/crmTicket';

interface Customer { id: number; print_name: string; }
interface AttachFile { name: string; size: string; }

function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 text-gray-400" style={{ fontSize: 8, lineHeight: 1 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className="mt-0.5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  );
}

const emptyFilters = {
  number:     '',
  contact:    '',
  createdBy:  '',
  assignedTo: '',
  dateFrom:   '',
  dateTo:     '',
  priority:   '',
  status:     '',
  tag:        '',
};
type Filters = typeof emptyFilters;

// ── Ticket Form ───────────────────────────────────────────────────────────────
interface FormProps {
  initial: CrmTicket | null;
  customers: Customer[];
  onSave: (data: Partial<CrmTicket>) => Promise<void>;
  onClose: () => void;
}

function TicketForm({ initial, customers, onSave, onClose }: FormProps) {
  const isEdit = initial !== null;
  const [nextNum, setNextNum]               = useState('');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');

  const [title, setTitle]                   = useState(initial?.title ?? '');
  const [ticketDate, setTicketDate]         = useState(
    initial?.ticket_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus]                 = useState<TicketStatus>(initial?.status ?? 'open');
  const [contactName, setContactName]       = useState(initial?.contact_name ?? '');
  const [phone, setPhone]                   = useState(initial?.phone ?? '');
  const [project, setProject]               = useState(initial?.project ?? '');
  const [tag, setTag]                       = useState(initial?.tag ?? '');
  const [assignedTo, setAssignedTo]         = useState(initial?.assigned_to ?? '');
  const [customerId, setCustomerId]         = useState<number | ''>(initial?.customer_id ?? '');
  const [city, setCity]                     = useState(initial?.city ?? '');
  const [priority, setPriority]             = useState(initial?.priority ?? 'Not Set');
  const [estimatedHours, setEstimatedHours] = useState<number>(initial?.estimated_hours ?? 0);
  const [actualHours, setActualHours]       = useState<number>(initial?.actual_hours ?? 0);
  const [description, setDescription]       = useState(initial?.description ?? initial?.notes ?? '');
  const [attachFiles, setAttachFiles]       = useState<AttachFile[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit) getNextTicketNumber().then(d => setNextNum(d.number)).catch(() => {});
  }, [isEdit]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachFiles(prev => [
      ...prev,
      ...files.map(f => ({
        name: f.name,
        size: f.size > 1048576
          ? `${(f.size / 1048576).toFixed(1)} MB`
          : `${(f.size / 1024).toFixed(0)} KB`,
      })),
    ]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSave() {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title, status, ticket_date: ticketDate || undefined,
        contact_name: contactName || undefined, phone: phone || undefined,
        project: project || undefined, tag: tag || undefined,
        assigned_to: assignedTo || undefined,
        customer_id: customerId !== '' ? Number(customerId) : undefined,
        city: city || undefined, priority: priority || undefined,
        estimated_hours: estimatedHours, actual_hours: actualHours,
        description: description || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const displayNum = isEdit ? initial.number : (nextNum || '…');

  const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const ChevronDown = () => (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Ticket - Edit [${displayNum}]` : `Ticket - Add [${displayNum}]`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          {/* Row 1: Number | Title (flex-1) | Date | Status */}
          <div className="flex gap-4 items-end">
            {/* Number */}
            <div className="shrink-0" style={{ width: 180 }}>
              <label className="block text-xs text-gray-500 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button type="button" className="bg-green-500 text-white px-2 py-1.5 hover:bg-green-600 flex items-center gap-0.5 text-xs font-bold">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
                <input type="text" readOnly className="flex-1 px-2 py-1.5 text-sm bg-gray-50 font-mono min-w-0" value={displayNum} />
                <button type="button" className="bg-green-500 text-white px-2 py-1.5 hover:bg-green-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="shrink-0 w-44">
              <label className="block text-xs text-gray-500 mb-1">Date <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" value={ticketDate} onChange={e => setTicketDate(e.target.value)} />
                {ticketDate && <button type="button" onClick={() => setTicketDate('')} className="px-1 text-gray-400 hover:text-gray-600 text-sm">×</button>}
                <span className="px-2 text-gray-400"><CalIcon /></span>
              </div>
            </div>

            {/* Status — green border */}
            <div className="shrink-0 w-44">
              <label className="block text-xs text-gray-500 mb-1">Status <span className="text-red-500">*</span></label>
              <div className="flex items-center border-2 border-green-500 rounded overflow-hidden">
                <select className="flex-1 px-2 py-1.5 text-sm focus:outline-none bg-white min-w-0" value={status} onChange={e => setStatus(e.target.value as TicketStatus)}>
                  {TICKET_STATUSES.map(s => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
                </select>
                <button type="button" onClick={() => setStatus('open')} className="px-1 text-gray-400 hover:text-gray-600 text-sm">×</button>
                <span className="px-1.5 text-gray-400"><ChevronDown /></span>
              </div>
            </div>
          </div>

          {/* Row 2: Contact | Project | Tag | Assigned To */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="text" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" placeholder="Type to search contact" value={contactName} onChange={e => setContactName(e.target.value)} />
                <span className="px-2 text-gray-400"><ChevronDown /></span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project</label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="text" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" placeholder="Type to search project" value={project} onChange={e => setProject(e.target.value)} />
                <span className="px-2 text-gray-400"><ChevronDown /></span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tag</label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="text" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" placeholder="Type to search Tag" value={tag} onChange={e => setTag(e.target.value)} />
                <span className="px-2 text-gray-400"><ChevronDown /></span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="text" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" placeholder="Type to search employee" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} />
                <span className="px-2 text-gray-400"><ChevronDown /></span>
              </div>
            </div>
          </div>

          {/* Row 3: Priority | Estimated Hours | Actual Hours | Customer */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Priority</label>
              <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={priority} onChange={e => setPriority(e.target.value)}>
                {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estimated Hours</label>
              <input type="number" min={0} step="0.5" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={estimatedHours} onChange={e => setEstimatedHours(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Actual Hours</label>
              <input type="number" min={0} step="0.5" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={actualHours} onChange={e => setActualHours(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer</label>
              <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={customerId} onChange={e => setCustomerId(Number(e.target.value) || '')}>
                <option value="">—</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Phone | City */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input type="text" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">City</label>
              <input type="text" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none resize-none" rows={5} placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Attachments */}
          <div>
            <p className="font-bold text-gray-800 mb-2">Attachments</p>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
            <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-gray-300 px-6 py-5 cursor-pointer hover:border-blue-400" onClick={() => fileRef.current?.click()}>
              <span className="text-sm text-gray-400">Drop files here or</span>
              <button type="button" className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 uppercase tracking-wide">BROWSE FILES</button>
            </div>
            {attachFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
                    <span className="text-gray-700 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400 mr-3">{f.size}</span>
                    <button type="button" onClick={() => setAttachFiles(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center gap-2 shrink-0">
          <div className="flex">
            <button type="button" onClick={handleSave} disabled={saving} className="bg-gray-200 text-gray-600 px-5 py-2 text-sm font-medium hover:bg-gray-300 rounded-l">
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button type="button" className="bg-gray-200 text-gray-600 px-2 py-2 hover:bg-gray-300 rounded-r border-l border-gray-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <button type="button" onClick={onClose} className="flex items-center gap-1 bg-yellow-400 text-white px-5 py-2 text-sm font-medium rounded hover:bg-yellow-500">
            <span className="text-lg leading-none">&times;</span> CLOSE
          </button>
        </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CrmTicketsPage() {
  const [tickets, setTickets]           = useState<CrmTicket[]>([]);
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [search, setSearch]             = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<CrmTicket | null>(null);
  const [error, setError]               = useState('');

  // Filters
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...emptyFilters });
  const activeFilterCount = Object.entries(appliedFilters).filter(([, v]) => v !== '').length;

  async function load(f: Filters = appliedFilters, q = search) {
    try {
      const params: Record<string, string> = {};
      if (f.status) params.status = f.status;
      if (q)        params.search = q;
      let data = await getCrmTickets(params);
      if (f.number)     data = data.filter(t => t.number?.toLowerCase().includes(f.number.toLowerCase()));
      if (f.contact)    data = data.filter(t => (t.contact_name ?? '').toLowerCase().includes(f.contact.toLowerCase()));
      if (f.createdBy)  data = data.filter(t => (t.created_by ?? '').toLowerCase().includes(f.createdBy.toLowerCase()));
      if (f.assignedTo) data = data.filter(t => (t.assigned_to ?? '').toLowerCase().includes(f.assignedTo.toLowerCase()));
      if (f.priority)   data = data.filter(t => (t.priority ?? '') === f.priority);
      if (f.tag)        data = data.filter(t => (t.tag ?? '').toLowerCase().includes(f.tag.toLowerCase()));
      if (f.dateFrom)   data = data.filter(t => (t.ticket_date ?? t.created_at) >= f.dateFrom);
      if (f.dateTo)     data = data.filter(t => (t.ticket_date ?? t.created_at) <= f.dateTo);
      setTickets(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  useEffect(() => {
    load();
    apiFetch('/api/customers?limit=500').then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : (d?.data ?? [])));
  }, []);

  useEffect(() => { load(appliedFilters, search); }, [search]);

  function applyFilters() {
    const f = { ...pendingFilters };
    setAppliedFilters(f);
    setShowFilters(false);
    load(f, search);
  }

  function clearFilters() {
    const f = { ...emptyFilters };
    setPendingFilters(f);
    setAppliedFilters(f);
    setShowFilters(false);
    load(f, search);
  }

  const save = async (data: Partial<CrmTicket>) => {
    if (editing) await updateCrmTicket(editing.id, data);
    else         await createCrmTicket(data);
    load();
    setShowForm(false); setEditing(null);
  };

  function ticketAge(t: CrmTicket) {
    const base = t.ticket_date ?? t.created_at;
    if (!base) return '—';
    const days = Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
    return `${days}d`;
  }

  if (showForm) return (
        <TicketForm
      initial={editing}
      customers={customers}
      onSave={save}
      onClose={() => { setShowForm(false); setEditing(null); }}
    />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title + Add button */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tickets</h1>
        <button
          className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          + ADD TICKETS
        </button>
      </div>

      {error && <p className="text-red-600 mb-2 text-sm">{error}</p>}

      {/* Row 2: FILTERS (left) + Search (right) */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => { setPendingFilters({ ...appliedFilters }); setShowFilters(true); }}
          className="relative flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
          FILTERS
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Search</span>
          <input
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-48"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Number <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Date <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Title <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Contact <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Phone 1 <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Phone 2 <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">City <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Ticket Age <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Created By <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Assigned To <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Status <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b whitespace-nowrap cursor-pointer hover:bg-gray-100">Tag <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.number}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{(t.ticket_date ?? t.created_at)?.slice(0, 10)}</td>
                <td className="px-3 py-2 text-xs font-medium max-w-[160px] truncate">{t.title}</td>
                <td className="px-3 py-2 text-xs">{t.contact_name || '—'}</td>
                <td className="px-3 py-2 text-xs">{t.phone || '—'}</td>
                <td className="px-3 py-2 text-xs">—</td>
                <td className="px-3 py-2 text-xs">{t.city || '—'}</td>
                <td className="px-3 py-2 text-xs">{ticketAge(t)}</td>
                <td className="px-3 py-2 text-xs">{t.created_by || '—'}</td>
                <td className="px-3 py-2 text-xs">{t.assigned_to || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[t.status]}`}>
                    {TICKET_STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{t.tag || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button title="Edit" className="text-blue-500 hover:text-blue-700" onClick={() => { setEditing(t); setShowForm(true); }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button title="Delete" className="text-red-400 hover:text-red-600" onClick={async () => { if (confirm('Delete this ticket?')) { await deleteCrmTicket(t.id); load(); } }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-orange-500">No record found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FILTERS Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white border-2 border-green-500 rounded-lg shadow-2xl w-full max-w-xl mx-4">
            {/* Floating × */}
            <button onClick={() => setShowFilters(false)} className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-red-600 z-10">×</button>

            <div className="px-6 py-5 space-y-3">

              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Number</label>
                <input
                  type="text"
                  placeholder="Type to search number"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.number}
                  onChange={e => setPendingFilters(p => ({ ...p, number: e.target.value }))}
                />
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Contact</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <input
                    type="text"
                    placeholder="Type to search contact"
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none min-w-0"
                    value={pendingFilters.contact}
                    onChange={e => setPendingFilters(p => ({ ...p, contact: e.target.value }))}
                  />
                  <span className="px-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Created By */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Created By</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <input
                    type="text"
                    placeholder="Type to search created by"
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none min-w-0"
                    value={pendingFilters.createdBy}
                    onChange={e => setPendingFilters(p => ({ ...p, createdBy: e.target.value }))}
                  />
                  <span className="px-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Assigned To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Assigned To</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <input
                    type="text"
                    placeholder="Type to search assigned to"
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none min-w-0"
                    value={pendingFilters.assignedTo}
                    onChange={e => setPendingFilters(p => ({ ...p, assignedTo: e.target.value }))}
                  />
                  <span className="px-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Date From/To with calendar icons */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.dateFrom} onChange={e => setPendingFilters(p => ({ ...p, dateFrom: e.target.value }))} />
                    <span className="px-2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.dateTo} onChange={e => setPendingFilters(p => ({ ...p, dateTo: e.target.value }))} />
                    <span className="px-2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Priority</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none min-w-0"
                    value={pendingFilters.priority}
                    onChange={e => setPendingFilters(p => ({ ...p, priority: e.target.value }))}
                  >
                    <option value="">Select priority</option>
                    {TICKET_PRIORITIES.filter(p => p !== 'Not Set').map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span className="px-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Status</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none min-w-0"
                    value={pendingFilters.status}
                    onChange={e => setPendingFilters(p => ({ ...p, status: e.target.value }))}
                  >
                    <option value="">Select status</option>
                    {TICKET_STATUSES.map(s => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
                  </select>
                  <span className="px-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Tags</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <input
                    type="text"
                    placeholder="Select tags"
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none min-w-0"
                    value={pendingFilters.tag}
                    onChange={e => setPendingFilters(p => ({ ...p, tag: e.target.value }))}
                  />
                  <span className="px-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 flex items-center gap-2">
              <button onClick={() => {}} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters} className="flex items-center gap-1 bg-gray-200 text-gray-600 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button onClick={clearFilters} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

