import { useEffect, useRef, useState } from 'react';
import type { CrmLead } from '../types/crmLead';
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_INDUSTRIES } from '../types/crmLead';
import { createCrmLead, updateCrmLead, getNextLeadNumber } from '../api/crmLeads';
import { validateEmail, validateName, validatePhone, validatePositive } from '../utils/validators';
import { apiFetch, parseJsonOrThrow } from '../api/apiFetch';
import SearchSelect from './SearchSelect';

interface Props { lead: CrmLead | null; onClose: () => void; onSaved: () => void; }

export default function CrmLeadForm({ lead, onClose, onSaved }: Props) {
  const isEdit = lead !== null;

  const [nextNumber,    setNextNumber]    = useState('');
  const [name,          setName]          = useState(lead?.name ?? '');
  const [contactName,   setContactName]   = useState(lead?.contact_name ?? '');
  const [company,       setCompany]       = useState(lead?.company ?? '');
  const [website,       setWebsite]       = useState(lead?.website ?? '');
  const [email,         setEmail]         = useState(lead?.email ?? '');
  const [phone,         setPhone]         = useState(lead?.phone ?? '');
  const [leadDate,      setLeadDate]      = useState(lead?.lead_date?.slice(0,10) ?? new Date().toISOString().slice(0,10));
  const [source,        setSource]        = useState(lead?.source ?? '');
  const [leadStatus,    setLeadStatus]    = useState(lead?.lead_status ?? '');
  const [industry,      setIndustry]      = useState(lead?.industry ?? '');
  const [tag,           setTag]           = useState(lead?.tag ?? '');
  const [annualRevenue, setAnnualRevenue] = useState(lead?.annual_revenue ?? 0);
  const [numEmployees,  setNumEmployees]  = useState(lead?.num_employees ?? 0);
  const [assignedTo,    setAssignedTo]    = useState(lead?.assigned_to ?? '');
  const [notes,         setNotes]         = useState(lead?.notes ?? '');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [fieldErrors,   setFieldErrors]   = useState<Record<string, string>>({});

  // Searchable dropdowns state
  const [showSource,   setShowSource]   = useState(false);
  const [showStatus,   setShowStatus]   = useState(false);
  const [showIndustry, setShowIndustry] = useState(false);
  const sourceRef   = useRef<HTMLDivElement>(null);
  const statusRef   = useRef<HTMLDivElement>(null);
  const industryRef = useRef<HTMLDivElement>(null);

  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!isEdit) getNextLeadNumber().then(d => setNextNumber(d.number)).catch(() => {});
    apiFetch('/api/crm-masters/ticket-tags').then(parseJsonOrThrow)
      .then(d => setTagOptions((d as { name: string }[]).map(t => t.name))).catch(() => {});
    apiFetch('/api/employees').then(parseJsonOrThrow)
      .then(d => setEmployeeOptions((d as { name: string }[]).map(e => e.name))).catch(() => {});
  }, [isEdit]);

  // Outside-click closes all dropdowns
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (sourceRef.current   && !sourceRef.current.contains(e.target as Node))   setShowSource(false);
      if (statusRef.current   && !statusRef.current.contains(e.target as Node))   setShowStatus(false);
      if (industryRef.current && !industryRef.current.contains(e.target as Node)) setShowIndustry(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function handleSave() {
    setError('');
    const leadName = name.trim() || contactName.trim() || company.trim();
    if (!leadName) { setError('Contact or Company is required'); return; }
    const errs: Record<string, string> = {};
    if (name.trim())        { const err = validateName(name, 'Lead name');        if (err) errs.name = err; }
    if (contactName.trim()) { const err = validateName(contactName, 'Contact');    if (err) errs.contactName = err; }
    if (company.trim())     { const err = validateName(company, 'Company');        if (err) errs.company = err; }
    const emailErr = validateEmail(email); if (emailErr) errs.email = emailErr;
    const phoneErr = validatePhone(phone); if (phoneErr) errs.phone = phoneErr;
    const revErr = validatePositive(annualRevenue, 'Annual revenue'); if (revErr) errs.annualRevenue = revErr;
    const empErr = validatePositive(numEmployees, 'Number of employees'); if (empErr) errs.numEmployees = empErr;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError('Please fix the highlighted fields before saving.'); return; }
    setSaving(true);
    try {
      const payload: Partial<CrmLead> = {
        name: leadName, company: company || null, email: email || null,
        phone: phone || null, source: source || null,
        stage: lead?.stage ?? 'new',
        probability: lead?.probability ?? 0,
        expected_revenue: lead?.expected_revenue ?? 0,
        assigned_to: assignedTo || null, notes: notes || null,
        lead_status: leadStatus || null, industry: industry || null,
        website: website || null, lead_date: leadDate || null,
        annual_revenue: Number(annualRevenue), num_employees: Number(numEmployees),
        contact_name: contactName || null, tag: tag || null,
      };
      if (isEdit) await updateCrmLead(lead.id, payload);
      else        await createCrmLead(payload);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const displayNum = isEdit ? (lead.number ?? '') : (nextNumber || '…');

  const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const Chevron = () => (
    <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Lead - Edit [${displayNum}]` : `Lead - Add [${displayNum}]`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          {/* Row 1: Number | Date | Company | Website | Contact */}
          <div className="grid grid-cols-5 gap-4 items-end">

            {/* Number */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button type="button" className="bg-green-500 text-white px-2 py-1.5 hover:bg-green-600 flex items-center">
                  <Chevron />
                </button>
                <input type="text" readOnly className="flex-1 px-2 py-1.5 text-sm bg-gray-50 font-mono min-w-0" value={displayNum} />
                <button type="button" className="bg-green-500 text-white px-2 py-1.5 hover:bg-green-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" value={leadDate} onChange={e => setLeadDate(e.target.value)} />
                {leadDate && <button type="button" onClick={() => setLeadDate('')} className="px-1 text-gray-400 hover:text-gray-600 text-sm">×</button>}
                <span className="px-2 text-gray-400"><CalIcon /></span>
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Company</label>
              <input type="text" placeholder="Company" className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.company ? 'border-red-500' : 'border-gray-300'}`} value={company} onChange={e => setCompany(e.target.value)} />
              {fieldErrors.company && <p className="text-xs text-red-500 mt-1">{fieldErrors.company}</p>}
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Website</label>
              <input type="text" placeholder="Website" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>

            {/* Contact — red border searchable */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact <span className="text-red-500">*</span></label>
              <div className={`flex items-center border-2 rounded overflow-hidden ${fieldErrors.contactName ? 'border-red-500' : 'border-red-400'}`}>
                <input type="text" placeholder="Type contact person name" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0" value={contactName} onChange={e => setContactName(e.target.value)} />
                <span className="px-2 text-gray-400"><Chevron /></span>
              </div>
              {fieldErrors.contactName && <p className="text-xs text-red-500 mt-1">{fieldErrors.contactName}</p>}
            </div>
          </div>

          {/* Row 2: Lead Source | Lead Status | Tag | Industry */}
          <div className="grid grid-cols-4 gap-4">

            {/* Lead Source — searchable select */}
            <div ref={sourceRef} className="relative">
              <label className="block text-xs text-gray-500 mb-1">Lead Source</label>
              <div
                className="flex items-center border border-gray-300 rounded overflow-hidden cursor-pointer"
                onClick={() => setShowSource(v => !v)}
              >
                <input
                  type="text" readOnly
                  className="flex-1 px-2 py-1.5 text-sm cursor-pointer bg-white min-w-0"
                  placeholder="Type to search lead source"
                  value={source}
                />
                <span className="px-2 text-gray-400"><Chevron /></span>
              </div>
              {showSource && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  <div className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-400" onMouseDown={() => { setSource(''); setShowSource(false); }}>— Clear —</div>
                  {LEAD_SOURCES.filter(s => s !== 'None').map(s => (
                    <div key={s} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={() => { setSource(s); setShowSource(false); }}>{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Lead Status — searchable select */}
            <div ref={statusRef} className="relative">
              <label className="block text-xs text-gray-500 mb-1">Lead Status</label>
              <div
                className="flex items-center border border-gray-300 rounded overflow-hidden cursor-pointer"
                onClick={() => setShowStatus(v => !v)}
              >
                <input
                  type="text" readOnly
                  className="flex-1 px-2 py-1.5 text-sm cursor-pointer bg-white min-w-0 truncate"
                  placeholder="Type to search lead status"
                  value={leadStatus}
                />
                <span className="px-2 text-gray-400"><Chevron /></span>
              </div>
              {showStatus && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  <div className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-400" onMouseDown={() => { setLeadStatus(''); setShowStatus(false); }}>— Clear —</div>
                  {LEAD_STATUSES.filter(s => s !== 'None').map(s => (
                    <div key={s} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={() => { setLeadStatus(s); setShowStatus(false); }}>{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Tag */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tag</label>
              <SearchSelect value={tag} onChange={setTag} options={tagOptions} placeholder="Type to search tag" />
            </div>

            {/* Industry — searchable select */}
            <div ref={industryRef} className="relative">
              <label className="block text-xs text-gray-500 mb-1">Industry</label>
              <div
                className="flex items-center border border-gray-300 rounded overflow-hidden cursor-pointer"
                onClick={() => setShowIndustry(v => !v)}
              >
                <input
                  type="text" readOnly
                  className="flex-1 px-2 py-1.5 text-sm cursor-pointer bg-white min-w-0 truncate"
                  placeholder="Type to search industry"
                  value={industry}
                />
                <span className="px-2 text-gray-400"><Chevron /></span>
              </div>
              {showIndustry && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  <div className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-400" onMouseDown={() => { setIndustry(''); setShowIndustry(false); }}>— Clear —</div>
                  {LEAD_INDUSTRIES.map(s => (
                    <div key={s} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={() => { setIndustry(s); setShowIndustry(false); }}>{s}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Assigned To | Annual Revenue | Email | Number of employees */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
              <SearchSelect value={assignedTo} onChange={setAssignedTo} options={employeeOptions} placeholder="Type to search employee" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Annual Revenue</label>
              <input type="number" min="0" step="any" placeholder="Annual Revenue" className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.annualRevenue ? 'border-red-500' : 'border-gray-300'}`} value={annualRevenue || ''} onChange={e => setAnnualRevenue(Number(e.target.value))} />
              {fieldErrors.annualRevenue && <p className="text-xs text-red-500 mt-1">{fieldErrors.annualRevenue}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input type="text" placeholder="Phone" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={phone} onChange={e => setPhone(e.target.value)} />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Number of employees</label>
              <input type="number" min="0" placeholder="Number Employee" className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.numEmployees ? 'border-red-500' : 'border-gray-300'}`} value={numEmployees || ''} onChange={e => setNumEmployees(Number(e.target.value))} />
              {fieldErrors.numEmployees && <p className="text-xs text-red-500 mt-1">{fieldErrors.numEmployees}</p>}
            </div>
          </div>

          {/* Row 4: Email | (hidden fields) */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" placeholder="Email" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" value={email} onChange={e => setEmail(e.target.value)} />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Lead Name</label>
              <input type="text" placeholder="Lead / Opportunity name" className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'}`} value={name} onChange={e => setName(e.target.value)} />
              {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none resize-none"
              rows={5}
              placeholder="Lead description"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center gap-2 shrink-0">
          <div className="flex">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-gray-200 text-gray-500 px-5 py-2 text-sm font-medium hover:bg-gray-300 rounded-l"
            >
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button type="button" className="bg-gray-200 text-gray-500 px-2 py-2 hover:bg-gray-300 rounded-r border-l border-gray-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 bg-orange-400 text-white px-5 py-2 text-sm font-medium rounded hover:bg-orange-500"
          >
            <span className="text-lg leading-none">&times;</span> CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
