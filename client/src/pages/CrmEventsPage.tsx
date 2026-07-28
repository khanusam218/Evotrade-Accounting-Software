import { apiFetch, parseJsonOrThrow } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import { getCrmEvents, getNextEventNumber, createCrmEvent, updateCrmEvent, deleteCrmEvent } from '../api/crmEvents';
import { CrmEvent, EventStatus, EVENT_TYPES, EVENT_PRIORITIES, EVENT_SOURCES } from '../types/crmEvent';
import { validateName, validatePhone } from '../utils/validators';
import SearchSelect from '../components/SearchSelect';

interface Customer { id: number; print_name: string; }

const STATUS_COLOR: Record<EventStatus, string> = {
  planned:   'bg-blue-100 text-blue-800',
  held:      'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ── Sort Direction type ───────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc' | null;

// ── Time picker: hh : mm [AM/PM] ─────────────────────────────────────────────
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function parseToDisplay(v: string) {
    if (!v) return { h: '09', m: '00', ap: 'AM' as 'AM' | 'PM' };
    const [hh, mm] = v.split(':');
    const hour = parseInt(hh ?? '9');
    const ap: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return { h: String(h12).padStart(2, '0'), m: mm ?? '00', ap };
  }
  const init = parseToDisplay(value);
  const [h, setH]   = useState(init.h);
  const [m, setM]   = useState(init.m);
  const [ap, setAp] = useState<'AM' | 'PM'>(init.ap);

  function emit(hStr: string, mStr: string, apStr: 'AM' | 'PM') {
    let hour = parseInt(hStr) || 0;
    if (apStr === 'PM' && hour !== 12) hour += 12;
    if (apStr === 'AM' && hour === 12) hour = 0;
    onChange(`${String(hour).padStart(2, '0')}:${mStr.padStart(2, '0')}`);
  }
  function handleH(val: string) {
    let n = parseInt(val); if (isNaN(n)) { setH(''); return; }
    n = Math.min(12, Math.max(1, n));
    const s = String(n).padStart(2, '0'); setH(s); emit(s, m, ap);
  }
  function handleM(val: string) {
    let n = parseInt(val); if (isNaN(n)) { setM(''); return; }
    n = Math.min(59, Math.max(0, n));
    const s = String(n).padStart(2, '0'); setM(s); emit(h, s, ap);
  }
  function toggleAp() { const na = ap === 'AM' ? 'PM' : 'AM'; setAp(na); emit(h, m, na); }

  return (
    <div className="flex items-center gap-1">
      <input type="number" min={1} max={12} className="input w-14 text-center px-1"
        value={h} onChange={e => handleH(e.target.value)} />
      <span className="text-gray-500 font-bold text-lg">:</span>
      <input type="number" min={0} max={59} className="input w-14 text-center px-1"
        value={m} onChange={e => handleM(e.target.value)} />
      <button type="button" onClick={toggleAp}
        className="px-3 py-2 rounded text-white text-sm font-bold bg-green-500 hover:bg-green-600 min-w-[48px]">
        {ap}
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function splitDateTime(dt?: string) {
  if (!dt) return { date: '', time: '' };
  const d = new Date(dt);
  if (isNaN(d.getTime())) return { date: dt.slice(0, 10), time: dt.slice(11, 16) };
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}
function joinDateTime(date: string, time: string) {
  return date ? `${date}T${time || '00:00'}:00` : '';
}
function fmtDT(dt?: string) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
}

interface AttachFile { name: string; size: string; }

// ── Event Form ────────────────────────────────────────────────────────────────
interface FormProps {
  initial: CrmEvent | null;
  customers: Customer[];
  onSave: (data: Partial<CrmEvent>) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'planned',   label: 'Planned'   },
  { value: 'held',      label: 'Held'      },
  { value: 'cancelled', label: 'Cancelled' },
];

function EventForm({ initial, onSave, onClose }: FormProps) {
  const isEdit = initial !== null;
  const [nextNum, setNextNum]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const [subject, setSubject]         = useState(initial?.subject ?? '');
  const [eventTypeSearch, setEventTypeSearch] = useState(initial?.event_type ?? '');
  const [eventType, setEventType]     = useState(initial?.event_type ?? '');
  const [showEventType, setShowEventType] = useState(false);
  const [status, setStatus]           = useState<EventStatus>(initial?.status ?? 'planned');
  const [showStatus, setShowStatus]   = useState(false);
  const [priority, setPriority]       = useState(initial?.priority ?? 'Not Set');
  const [showPriority, setShowPriority] = useState(false);
  const [contactName, setContactName] = useState(initial?.contact_name ?? '');
  const [phone, setPhone]             = useState(initial?.phone ?? '');
  const [phone2, setPhone2]           = useState(initial?.phone_2 ?? '');
  const [city, setCity]               = useState(initial?.city ?? '');
  const [source, setSource]           = useState(initial?.source ?? '');
  const [description, setDescription] = useState(initial?.description ?? initial?.notes ?? '');
  const [assignedTo, setAssignedTo]   = useState(initial?.assigned_to ?? '');
  const [attachFiles, setAttachFiles] = useState<AttachFile[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const sp = splitDateTime(initial?.start_date);
  const ep = splitDateTime(initial?.end_date);
  const [startDate, setStartDate] = useState(sp.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(sp.time || '09:00');
  const [endDate, setEndDate]     = useState(ep.date || new Date().toISOString().slice(0, 10));
  const [endTime, setEndTime]     = useState(ep.time || '10:00');

  const eventTypeRef = useRef<HTMLDivElement>(null);
  const statusRef    = useRef<HTMLDivElement>(null);
  const priorityRef  = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);

  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!isEdit) getNextEventNumber().then(d => setNextNum(d.number)).catch(() => {});
    apiFetch('/api/employees').then(parseJsonOrThrow)
      .then(d => setEmployeeOptions((d as { name: string }[]).map(e => e.name))).catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (eventTypeRef.current && !eventTypeRef.current.contains(e.target as Node)) setShowEventType(false);
      if (statusRef.current    && !statusRef.current.contains(e.target as Node))    setShowStatus(false);
      if (priorityRef.current  && !priorityRef.current.contains(e.target as Node))  setShowPriority(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredTypes = EVENT_TYPES.filter(t => t.toLowerCase().includes(eventTypeSearch.toLowerCase()));
  const statusLabel   = STATUS_OPTIONS.find(s => s.value === status)?.label ?? '';

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachFiles(prev => [
      ...prev,
      ...files.map(f => ({
        name: f.name,
        size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`,
      })),
    ]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSave(saveAndNew = false) {
    setError('');
    if (!subject.trim()) { setError('Subject is required'); return; }
    const sd = joinDateTime(startDate, startTime);
    const ed = joinDateTime(endDate, endTime);
    if (ed && sd && new Date(ed) < new Date(sd)) { setError('End must be ≥ Start'); return; }
    const errs: Record<string, string> = {};
    if (!eventType.trim()) errs.eventType = 'Event Type is required.';
    if (!source.trim()) errs.source = 'Source is required.';
    const assignedErr = validateName(assignedTo, 'Assigned To'); if (assignedErr) errs.assignedTo = assignedErr;
    if (contactName.trim()) { const err = validateName(contactName, 'Contact'); if (err) errs.contactName = err; }
    const phoneErr = validatePhone(phone); if (phoneErr) errs.phone = phoneErr;
    const phone2Err = validatePhone(phone2); if (phone2Err) errs.phone2 = phone2Err;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError('Please fix the highlighted fields before saving.'); return; }
    setSaving(true);
    try {
      await onSave({
        subject, event_type: eventType || undefined, status,
        priority: priority || undefined,
        source: source || undefined, description: description || undefined,
        start_date: sd || undefined, end_date: ed || undefined,
        assigned_to: assignedTo || undefined,
        contact_name: contactName || undefined, phone: phone || undefined,
        phone_2: phone2 || undefined, city: city || undefined,
      });
      if (saveAndNew) {
        setSubject(''); setEventType(''); setEventTypeSearch('');
        setStatus('planned'); setPriority('Not Set');
        setSource(''); setDescription(''); setAssignedTo('');
        setContactName(''); setPhone(''); setPhone2(''); setCity('');
        setAttachFiles([]);
        const today = new Date().toISOString().slice(0, 10);
        setStartDate(today); setEndDate(today); setStartTime('09:00'); setEndTime('10:00');
        getNextEventNumber().then(d => setNextNum(d.number)).catch(() => {});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const displayNum = isEdit ? initial.number : (nextNum || '');

  // ── chevron SVG ──
  const Chevron = () => (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center border-b px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Event - Edit [${initial.number}]` : `Event - Add [${displayNum}]`}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          {/* Row 1: Number | Subject | Event Type | Status */}
          <div className="flex gap-3 items-end flex-wrap">
            {/* Number */}
            <div className="shrink-0">
              <label className="block text-sm text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex items-stretch border border-gray-300 rounded overflow-hidden">
                <button type="button" className="bg-green-500 hover:bg-green-600 px-2 flex items-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
                <input readOnly value={displayNum} className="w-28 px-2 py-1.5 text-sm bg-white focus:outline-none font-mono" />
                <button type="button"
                  onClick={() => getNextEventNumber().then(d => setNextNum(d.number)).catch(() => {})}
                  className="bg-green-500 hover:bg-green-600 px-2 flex items-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* Subject */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
              <input className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Event subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            {/* Event Type */}
            <div className="w-52 shrink-0" ref={eventTypeRef}>
              <label className="block text-sm text-gray-700 mb-1">Event Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="text" placeholder="Type to search event type"
                  className={`w-full border rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.eventType ? 'border-red-500' : 'border-gray-300'}`}
                  value={eventTypeSearch}
                  onChange={e => { setEventTypeSearch(e.target.value); setEventType(e.target.value); setShowEventType(true); }}
                  onFocus={() => setShowEventType(true)} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Chevron /></span>
                {showEventType && filteredTypes.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg max-h-44 overflow-y-auto">
                    {filteredTypes.map(t => (
                      <div key={t} className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100"
                        onMouseDown={() => { setEventType(t); setEventTypeSearch(t); setShowEventType(false); }}>
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {fieldErrors.eventType && <p className="text-xs text-red-500 mt-1">{fieldErrors.eventType}</p>}
            </div>

            {/* Status */}
            <div className="w-48 shrink-0" ref={statusRef}>
              <label className="block text-sm text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
              <div className="relative flex items-center border-2 border-green-500 rounded overflow-visible">
                <input type="text" readOnly placeholder="Type to search status"
                  className="flex-1 px-3 py-1.5 text-sm bg-white focus:outline-none cursor-pointer min-w-0"
                  value={statusLabel} onClick={() => setShowStatus(v => !v)} />
                {status && (
                  <button type="button" className="px-1 text-gray-400 hover:text-gray-600 shrink-0"
                    onMouseDown={e => { e.preventDefault(); setStatus('planned'); }}>×</button>
                )}
                <button type="button" className="px-2 text-gray-400 shrink-0" onClick={() => setShowStatus(v => !v)}>
                  <Chevron />
                </button>
                {showStatus && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg">
                    {STATUS_OPTIONS.map(opt => (
                      <div key={opt.value} className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100"
                        onMouseDown={() => { setStatus(opt.value); setShowStatus(false); }}>
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Start Date | Start Time | End Date | End Time | Priority */}
          <div className="flex gap-3 items-end flex-wrap">
            {/* Start Date */}
            <div className="shrink-0">
              <label className="block text-sm text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="px-2 py-1.5 text-sm focus:outline-none"
                  value={startDate} onChange={e => setStartDate(e.target.value)} />
                {startDate && (
                  <button type="button" className="px-1 text-gray-400 hover:text-gray-600"
                    onClick={() => setStartDate('')}>×</button>
                )}
                <span className="px-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </span>
              </div>
            </div>

            {/* Start Time */}
            <div className="shrink-0">
              <label className="block text-sm text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>

            {/* End Date */}
            <div className="shrink-0">
              <label className="block text-sm text-gray-700 mb-1">End Date <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="px-2 py-1.5 text-sm focus:outline-none"
                  value={endDate} onChange={e => setEndDate(e.target.value)} />
                {endDate && (
                  <button type="button" className="px-1 text-gray-400 hover:text-gray-600"
                    onClick={() => setEndDate('')}>×</button>
                )}
                <span className="px-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </span>
              </div>
            </div>

            {/* End Time */}
            <div className="shrink-0">
              <label className="block text-sm text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
              <TimePicker value={endTime} onChange={setEndTime} />
            </div>

            {/* Priority */}
            <div className="flex-1 min-w-[160px]" ref={priorityRef}>
              <label className="block text-sm text-gray-700 mb-1">Priority <span className="text-red-500">*</span></label>
              <div className="relative flex items-center border-2 border-green-500 rounded overflow-visible">
                <input type="text" readOnly
                  className="flex-1 px-3 py-1.5 text-sm bg-white focus:outline-none cursor-pointer min-w-0"
                  value={priority} onClick={() => setShowPriority(v => !v)} />
                {priority && priority !== 'Not Set' && (
                  <button type="button" className="px-1 text-gray-400 hover:text-gray-600 shrink-0"
                    onMouseDown={e => { e.preventDefault(); setPriority('Not Set'); }}>×</button>
                )}
                <button type="button" className="px-2 text-gray-400 shrink-0" onClick={() => setShowPriority(v => !v)}>
                  <Chevron />
                </button>
                {showPriority && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg">
                    {EVENT_PRIORITIES.map(p => (
                      <div key={p} className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100"
                        onMouseDown={() => { setPriority(p); setShowPriority(false); }}>
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Assigned To | Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Assigned To <span className="text-red-500">*</span></label>
              <SearchSelect value={assignedTo} onChange={setAssignedTo} options={employeeOptions}
                placeholder="Type to search employee" hasError={!!fieldErrors.assignedTo} />
              {fieldErrors.assignedTo && <p className="text-xs text-red-500 mt-1">{fieldErrors.assignedTo}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Source <span className="text-red-500">*</span></label>
              <div className={`flex items-center border rounded overflow-hidden ${fieldErrors.source ? 'border-red-500' : 'border-gray-300'}`}>
                <select className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none"
                  value={source} onChange={e => setSource(e.target.value)}>
                  <option value="">Selected source</option>
                  {EVENT_SOURCES.filter(s => s !== 'None').map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="px-2 text-gray-400 pointer-events-none"><Chevron /></span>
              </div>
              {fieldErrors.source && <p className="text-xs text-red-500 mt-1">{fieldErrors.source}</p>}
            </div>
          </div>

          {/* Row 3b: Contact Person | Phone 1 | Phone 2 | City */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Contact Person</label>
              <input type="text" placeholder="Contact person"
                className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.contactName ? 'border-red-500' : 'border-gray-300'}`}
                value={contactName} onChange={e => setContactName(e.target.value)} />
              {fieldErrors.contactName && <p className="text-xs text-red-500 mt-1">{fieldErrors.contactName}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Phone 1</label>
              <input type="text" placeholder="Phone 1"
                className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                value={phone} onChange={e => setPhone(e.target.value)} />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Phone 2</label>
              <input type="text" placeholder="Phone 2"
                className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.phone2 ? 'border-red-500' : 'border-gray-300'}`}
                value={phone2} onChange={e => setPhone2(e.target.value)} />
              {fieldErrors.phone2 && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone2}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">City</label>
              <input type="text" placeholder="City"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Description</label>
            <textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none resize-none"
              rows={4} placeholder="Event description"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Attachments */}
          <div>
            <p className="text-sm font-bold text-gray-800 mb-2">Attachments</p>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center cursor-pointer hover:border-gray-400"
              onClick={() => fileRef.current?.click()}>
              <svg className="mx-auto mb-2 h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="mt-1 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                BROWSE FILES
              </button>
            </div>
            {attachFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
                    <span className="text-gray-700 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400 mr-3">{f.size}</span>
                    <button type="button" onClick={() => setAttachFiles(p => p.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer: SAVE AND NEW ▲ | × CLOSE */}
        <div className="border-t px-6 py-4 flex items-center justify-end gap-2 shrink-0">
          <div className="flex items-stretch rounded overflow-hidden border border-gray-300">
            <button type="button" onClick={() => handleSave(false)} disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-300">
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button type="button"
              className="px-2 bg-gray-200 text-gray-500 border-l border-gray-300 hover:bg-gray-300">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="flex items-center gap-1 bg-yellow-400 text-white px-4 py-2 rounded text-sm font-medium hover:bg-yellow-500">
            <span className="text-lg leading-none">&times;</span> CLOSE
          </button>
        </div>
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────
const emptyEventFilters = {
  number:            '',
  assignedTo:        '',
  startFrom:         '',
  startTo:           '',
  endFrom:           '',
  endTo:             '',
  eventStatus:       '',
  eventType:         '',
  statusUpdatedFrom: '',
  statusUpdatedTo:   '',
};
type EventFilters = typeof emptyEventFilters;

// ── SortIcon ─────────────────────────────────────────────────────────────────
function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 text-gray-400" style={{ fontSize: 8, lineHeight: 1 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className="mt-0.5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CrmEventsPage() {
  const [events, setEvents]   = useState<CrmEvent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch]   = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<CrmEvent | null>(null);
  const [error, setError]         = useState('');
  const [sort, setSort]           = useState<{ col: string; dir: SortDir }>({ col: 'start_date', dir: 'desc' });

  // Filters
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<EventFilters>({ ...emptyEventFilters });
  const [appliedFilters, setAppliedFilters] = useState<EventFilters>({ ...emptyEventFilters });

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== '').length;

  function load(f: EventFilters = appliedFilters, q = search) {
    const params: Record<string, string> = {};
    if (q) params.search = q;
    if (f.eventStatus) params.status = f.eventStatus;
    if (f.eventType)   params.event_type = f.eventType;
    getCrmEvents(params).then(data => {
      let filtered = data;
      if (f.number)     filtered = filtered.filter(e => (e.number ?? '').toLowerCase().includes(f.number.toLowerCase()));
      if (f.assignedTo) filtered = filtered.filter(e => (e.assigned_to ?? '').toLowerCase().includes(f.assignedTo.toLowerCase()));
      if (f.startFrom)  filtered = filtered.filter(e => (e.start_date ?? '') >= f.startFrom);
      if (f.startTo)    filtered = filtered.filter(e => (e.start_date ?? '') <= f.startTo + 'T23:59:59');
      if (f.endFrom)           filtered = filtered.filter(e => (e.end_date ?? '') >= f.endFrom);
      if (f.endTo)             filtered = filtered.filter(e => (e.end_date ?? '') <= f.endTo + 'T23:59:59');
      if (f.statusUpdatedFrom) filtered = filtered.filter(e => (e.status_updated_on ?? '') >= f.statusUpdatedFrom);
      if (f.statusUpdatedTo)   filtered = filtered.filter(e => (e.status_updated_on ?? '') <= f.statusUpdatedTo + 'T23:59:59');
      setEvents(filtered);
    }).catch(e => setError(e.message));
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
    const f = { ...emptyEventFilters };
    setPendingFilters(f);
    setAppliedFilters(f);
    setShowFilters(false);
    load(f, search);
  }

  function toggleSort(col: string) {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : prev.dir === 'desc' ? null : 'asc' }
        : { col, dir: 'asc' }
    );
  }

  const sorted = [...events].sort((a, b) => {
    if (!sort.dir) return 0;
    const av = (a as unknown as Record<string, unknown>)[sort.col] ?? '';
    const bv = (b as unknown as Record<string, unknown>)[sort.col] ?? '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const save = async (data: Partial<CrmEvent>) => {
    if (editing) await updateCrmEvent(editing.id, data);
    else         await createCrmEvent(data);
    load();
    setShowForm(false); setEditing(null);
  };

  // calendar icon SVG
  const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  if (showForm) return (
        <EventForm
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
        <h1 className="text-2xl font-bold text-gray-800">Events</h1>
        <button
          className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          + ADD EVENT
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
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('number')}>Number <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('subject')}>Subject <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('contact_name')}>Contact <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('phone')}>Phone 1 <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('phone_2')}>Phone 2 <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('city')}>City <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('assigned_to')}>Assigned To <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('start_date')}>Start Date <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('end_date')}>End Date <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('event_type')}>Event Type <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('status')}>Status <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('status_updated_on')}>Status Updated On <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(ev => (
              <tr key={ev.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">{ev.number}</td>
                <td className="px-3 py-2 text-xs max-w-[180px] truncate">{ev.subject}</td>
                <td className="px-3 py-2 text-xs">{ev.contact_name || '—'}</td>
                <td className="px-3 py-2 text-xs">{ev.phone || '—'}</td>
                <td className="px-3 py-2 text-xs">{ev.phone_2 || '—'}</td>
                <td className="px-3 py-2 text-xs">{ev.city || '—'}</td>
                <td className="px-3 py-2 text-xs">{ev.assigned_to || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDT(ev.start_date)}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDT(ev.end_date)}</td>
                <td className="px-3 py-2 text-xs">{ev.event_type || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[ev.status]}`}>
                    {ev.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDT(ev.status_updated_on)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button title="Edit" className="text-blue-500 hover:text-blue-700"
                      onClick={() => { setEditing(ev); setShowForm(true); }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button title="Delete" className="text-red-400 hover:text-red-600"
                      onClick={async () => { if (confirm('Delete this event?')) { await deleteCrmEvent(ev.id); load(); } }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
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
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-red-600 z-10">×</button>

            <div className="px-6 py-5 space-y-3">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Number</label>
                <input type="text" placeholder="Type to search number"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.number} onChange={e => setPendingFilters(p => ({ ...p, number: e.target.value }))} />
              </div>

              {/* Assigned To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Assigned To</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search assigned to"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.assignedTo} onChange={e => setPendingFilters(p => ({ ...p, assignedTo: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Start Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Start Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.startFrom} onChange={e => setPendingFilters(p => ({ ...p, startFrom: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.startTo} onChange={e => setPendingFilters(p => ({ ...p, startTo: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                </div>
              </div>

              {/* End Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">End Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.endFrom} onChange={e => setPendingFilters(p => ({ ...p, endFrom: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.endTo} onChange={e => setPendingFilters(p => ({ ...p, endTo: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                </div>
              </div>

              {/* Event Status */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Event Status</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none"
                    value={pendingFilters.eventStatus} onChange={e => setPendingFilters(p => ({ ...p, eventStatus: e.target.value }))}>
                    <option value="">Select event status</option>
                    <option value="planned">Planned</option>
                    <option value="held">Held</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className="px-2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Event Type */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Event Type</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none"
                    value={pendingFilters.eventType} onChange={e => setPendingFilters(p => ({ ...p, eventType: e.target.value }))}>
                    <option value="">Select event type</option>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="px-2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Status Updated On From/To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Status Updated On</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.statusUpdatedFrom} onChange={e => setPendingFilters(p => ({ ...p, statusUpdatedFrom: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.statusUpdatedTo} onChange={e => setPendingFilters(p => ({ ...p, statusUpdatedTo: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
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

