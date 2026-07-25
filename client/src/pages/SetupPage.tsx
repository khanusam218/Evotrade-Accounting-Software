import { useEffect, useRef, useState } from 'react';
import api from '../api/axiosConfig';
import { getCompanySettings, updateCompanySettings, getNumberSeries, updateNumberSeries } from '../api/companySettings';
import { getButtonColor, setButtonColor } from '../theme';

const IMAGES_KEY = 'evotrade_company_images';

type Series = { prefix: string; next_number: number; padding: number };
type Tab = 'information' | 'numbering' | 'categories' | 'adjustment-types' | 'crm-masters' | 'taxes';

interface CompanyData {
  company_name: string; organization_type: string; slug: string;
  address: string; country: string; city: string; state: string; zip: string;
  email: string; contact_person: string; phone: string; fax: string; ntn: string; cnic: string;
}
const EMPTY: CompanyData = {
  company_name: '', organization_type: '', slug: '', address: '', country: '',
  city: '', state: '', zip: '', email: '', contact_person: '', phone: '', fax: '', ntn: '', cnic: '',
};

const PK_PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir', 'Islamabad Capital Territory'];
const PK_CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Gujranwala', 'Sialkot', 'Sargodha', 'Bahawalpur', 'Sukkur', 'Larkana', 'Abbottabad', 'Gujrat', 'Sahiwal'];

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const ZIP_RE   = /^[A-Za-z0-9\- ]{3,10}$/;
const NTN_RE   = /^\d{7}-?\d?$/;
const CNIC_RE  = /^\d{5}-?\d{7}-?\d$/;
const NAME_RE  = /^[A-Za-z\s.'-]{2,50}$/;

function validateField(key: keyof CompanyData, value: string): string {
  const v = value.trim();
  switch (key) {
    case 'ntn':   return v && !NTN_RE.test(v)   ? 'NTN must be 7 digits (optionally with a check digit), e.g. 1234567-8.' : '';
    case 'cnic':  return v && !CNIC_RE.test(v)  ? 'CNIC must be 13 digits, e.g. 12345-1234567-1.' : '';
    case 'phone': return v && !PHONE_RE.test(v) ? 'Enter a valid phone number.' : '';
    case 'fax':   return v && !PHONE_RE.test(v) ? 'Enter a valid fax number.' : '';
    case 'zip':   return v && !ZIP_RE.test(v)   ? 'Enter a valid zip/postal code.' : '';
    case 'city':  return v && !NAME_RE.test(v)  ? 'City should contain letters only.' : '';
    case 'state': return v && !NAME_RE.test(v)  ? 'State should contain letters only.' : '';
    default: return '';
  }
}

// ── Generic inline list editor ────────────────────────────────────────────────
interface SimpleItem { id: number; name: string; is_active?: boolean; [key: string]: unknown; }

function SimpleListEditor({
  title, endpoint, extraFields
}: {
  title: string;
  endpoint: string;
  extraFields?: { key: string; label: string; type?: string }[];
}) {
  const [items, setItems] = useState<SimpleItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newExtras, setNewExtras] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editExtras, setEditExtras] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = () => api.get(`/${endpoint}`).then(r => setItems(r.data));
  useEffect(() => { load(); }, [endpoint]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const add = async () => {
    if (!newName.trim()) return;
    const payload: Record<string, string> = { name: newName, ...newExtras };
    try {
      await api.post(`/${endpoint}`, payload);
      setNewName(''); setNewExtras({}); load();
      setMsg({ type: 'ok', text: `${title} item added successfully.` });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add item.';
      setMsg({ type: 'err', text });
    }
  };

  const startEdit = (item: SimpleItem) => {
    setEditId(item.id); setEditName(item.name);
    const ex: Record<string, string> = {};
    extraFields?.forEach(f => { ex[f.key] = String(item[f.key] ?? ''); });
    setEditExtras(ex);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    const payload: Record<string, string> = { name: editName, ...editExtras };
    try {
      await api.put(`/${endpoint}/${editId}`, payload);
      setEditId(null); load();
      setMsg({ type: 'ok', text: 'Updated successfully.' });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update item.';
      setMsg({ type: 'err', text });
    }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/${endpoint}/${id}`);
      load();
      setMsg({ type: 'ok', text: 'Deleted successfully.' });
    } catch (e: unknown) {
      const text = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete item.';
      setMsg({ type: 'err', text });
    }
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="border-b bg-gray-50 px-4 py-3 font-medium text-gray-700 text-sm">{title}</div>
      {msg && (
        <div className={`px-4 py-2 text-xs font-medium ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      <div className="p-4 space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            {editId === item.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                {extraFields?.map(f => (
                  <input key={f.key} type={f.type || 'text'} value={editExtras[f.key] || ''} placeholder={f.label}
                    onChange={e => setEditExtras(x => ({ ...x, [f.key]: e.target.value }))}
                    className="w-28 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                ))}
                <button onClick={saveEdit} className="text-xs text-green-600 hover:underline">Save</button>
                <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800">{item.name}</span>
                {extraFields?.map(f => (
                  f.type === 'color'
                    ? <span key={f.key} className="w-5 h-5 rounded-full border" style={{ background: String(item[f.key] || '#ccc') }} />
                    : <span key={f.key} className="text-xs text-gray-500">{String(item[f.key] ?? '')}</span>
                ))}
                <button onClick={() => startEdit(item)} className="text-xs text-brand-600 hover:underline">Edit</button>
                <button onClick={() => del(item.id)} className="text-xs text-red-500 hover:underline">Del</button>
              </>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={`New ${title.toLowerCase()}…`}
            onKeyDown={e => e.key === 'Enter' && add()}
            className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
          {extraFields?.map(f => (
            <input key={f.key} type={f.type || 'text'} value={newExtras[f.key] || ''} placeholder={f.label}
              onChange={e => setNewExtras(x => ({ ...x, [f.key]: e.target.value }))}
              className="w-28 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
          ))}
          <button onClick={add} disabled={!newName.trim()}
            className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Adjustment Types editor ──────────────────────────────────────────────────
function AdjustmentTypesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', direction: 'add', description: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = () => api.get(`/adjustment-types`).then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      if (editId) {
        await api.put(`/adjustment-types/${editId}`, form);
        setEditId(null);
        setMsg({ type: 'ok', text: 'Adjustment type updated successfully.' });
      } else {
        await api.post(`/adjustment-types`, form);
        setMsg({ type: 'ok', text: 'Adjustment type added successfully.' });
      }
      setForm({ name: '', direction: 'add', description: '' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed to save adjustment type.' });
    }
  };

  const startEdit = (item: any) => {
    setEditId(item.id);
    setForm({ name: item.name, direction: item.direction, description: item.description || '' });
  };

  const del = async (id: number) => {
    if (!confirm('Delete this adjustment type?')) return;
    try { await api.delete(`/adjustment-types/${id}`); load(); setMsg({ type: 'ok', text: 'Deleted successfully.' }); }
    catch (e: any) { setMsg({ type: 'err', text: e.response?.data?.error || 'Delete failed' }); }
  };

  const toggle = async (item: any) => {
    await api.put(`/adjustment-types/${item.id}`, { ...item, is_active: !item.is_active });
    load();
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded px-4 py-2 text-sm font-medium ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{editId ? 'Edit' : 'New'} Adjustment Type</h3>
        <div className="flex gap-2 flex-wrap">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
            className="rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 w-44" />
          <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
            className="rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
            <option value="add">Add (Increase Stock)</option>
            <option value="subtract">Subtract (Decrease Stock)</option>
          </select>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
            className="rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 flex-1 min-w-40" />
          <button onClick={save} disabled={!form.name.trim()}
            className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {editId ? 'Update' : 'Add'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ name: '', direction: 'add', description: '' }); }}
            className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>}
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.direction === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.direction === 'add' ? '+ Add' : '- Subtract'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{item.description || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs ${item.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right space-x-3">
                  <button onClick={() => startEdit(item)} className="text-xs text-brand-600 hover:underline">Edit</button>
                  <button onClick={() => toggle(item)} className="text-xs text-gray-500 hover:underline">
                    {item.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => del(item.id)} className="text-xs text-red-500 hover:underline">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Taxes editor ──────────────────────────────────────────────────────────────
interface TaxItem {
  id: number; name: string; abbreviation: string; rate: number;
  applies_to_sales: boolean; applies_to_purchases: boolean; is_active: boolean;
}
const EMPTY_TAX_FORM = { name: '', abbreviation: '', rate: '', applies_to_sales: true, applies_to_purchases: true };

function TaxesTab() {
  const [items, setItems] = useState<TaxItem[]>([]);
  const [form, setForm] = useState(EMPTY_TAX_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = () => api.get('/taxes').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const save = async () => {
    if (!form.name.trim() || !form.abbreviation.trim() || form.rate === '') return;
    const payload = { ...form, rate: Number(form.rate) };
    try {
      if (editId) {
        await api.put(`/taxes/${editId}`, payload);
        setEditId(null);
        setMsg({ type: 'ok', text: 'Tax updated successfully.' });
      } else {
        await api.post('/taxes', payload);
        setMsg({ type: 'ok', text: 'Tax added successfully.' });
      }
      setForm(EMPTY_TAX_FORM);
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed to save tax.' });
    }
  };

  const startEdit = (item: TaxItem) => {
    setEditId(item.id);
    setForm({
      name: item.name, abbreviation: item.abbreviation, rate: String(item.rate),
      applies_to_sales: item.applies_to_sales, applies_to_purchases: item.applies_to_purchases,
    });
  };

  const del = async (id: number) => {
    if (!confirm('Delete this tax?')) return;
    try { await api.delete(`/taxes/${id}`); load(); setMsg({ type: 'ok', text: 'Deleted successfully.' }); }
    catch (e: any) { setMsg({ type: 'err', text: e.response?.data?.error || 'Delete failed' }); }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded px-4 py-2 text-sm font-medium ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      <div className="rounded-lg border bg-white shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{editId ? 'Edit' : 'New'} Tax</h3>
        <div className="flex gap-2 flex-wrap items-center">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
            className="rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 w-40" />
          <input value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} placeholder="Abbreviation *"
            className="rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 w-32" />
          <input type="number" min="0" max="100" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="Rate % *"
            className="rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 w-28" />
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={form.applies_to_sales} onChange={e => setForm(f => ({ ...f, applies_to_sales: e.target.checked }))} />
            Applies to Sales
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={form.applies_to_purchases} onChange={e => setForm(f => ({ ...f, applies_to_purchases: e.target.checked }))} />
            Applies to Purchases
          </label>
          <button onClick={save} disabled={!form.name.trim() || !form.abbreviation.trim() || form.rate === ''}
            className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {editId ? 'Update' : 'Add'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(EMPTY_TAX_FORM); }}
            className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>}
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Abbr.</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Purchases</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{item.abbreviation}</td>
                <td className="px-4 py-2.5 text-gray-500">{item.rate}%</td>
                <td className="px-4 py-2.5">{item.applies_to_sales ? '✓' : '—'}</td>
                <td className="px-4 py-2.5">{item.applies_to_purchases ? '✓' : '—'}</td>
                <td className="px-4 py-2.5 text-right space-x-3">
                  <button onClick={() => startEdit(item)} className="text-xs text-brand-600 hover:underline">Edit</button>
                  <button onClick={() => del(item.id)} className="text-xs text-red-500 hover:underline">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main SetupPage ───────────────────────────────────────────────────────────
export default function SetupPage() {
  const [tab,            setTab]           = useState<Tab>('information');
  const [data,           setData]          = useState<CompanyData>(EMPTY);
  const [fieldErrors,    setFieldErrors]   = useState<Partial<Record<keyof CompanyData, string>>>({});
  const [profileImage,   setProfileImage]  = useState<string | null>(null);
  const [signatureImage, setSignatureImage]= useState<string | null>(null);
  const [infoSaving,     setInfoSaving]    = useState(false);
  const [infoSaved,      setInfoSaved]     = useState(false);
  const [infoError,      setInfoError]     = useState('');
  const profileInputRef   = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [btnColor, setBtnColor] = useState<string | null>(() => getButtonColor());

  const pickButtonColor = (c: string | null) => { setButtonColor(c); setBtnColor(c); };
  const BTN_PRESETS = ['#2563eb', '#059669', '#16a34a', '#dc2626', '#ea580c', '#9333ea', '#0891b2', '#db2777', '#475569', '#ca8a04'];

  // ── Login credentials ──
  const loadCreds = (): { id: string; password: string } => {
    try { return JSON.parse(localStorage.getItem('evotrade_credentials') || 'null') || { id: 'admin', password: 'admin' }; }
    catch { return { id: 'admin', password: 'admin' }; }
  };
  const [credId,      setCredId]      = useState<string>(() => loadCreds().id);
  const [oldPass,     setOldPass]     = useState('');
  const [credPass,    setCredPass]    = useState('');
  const [credConfirm, setCredConfirm] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showCredPass,setShowCredPass]= useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [credMsg,     setCredMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function saveId() {
    if (!credId.trim()) { setCredMsg({ type: 'err', text: 'ID is required.' }); return; }
    const creds = loadCreds();
    try { localStorage.setItem('evotrade_credentials', JSON.stringify({ id: credId.trim(), password: creds.password })); } catch {}
    setCredMsg({ type: 'ok', text: 'ID updated.' });
  }

  async function savePassword() {
    if (!oldPass)                { setCredMsg({ type: 'err', text: 'Enter your current password.' }); return; }
    if (!credPass)               { setCredMsg({ type: 'err', text: 'Enter a new password.' }); return; }
    if (credPass.length < 6)     { setCredMsg({ type: 'err', text: 'New password must be at least 6 characters.' }); return; }
    if (credPass !== credConfirm){ setCredMsg({ type: 'err', text: 'Passwords do not match.' }); return; }

    setCredMsg({ type: 'ok', text: 'Saving…' });
    try {
      const token = localStorage.getItem('evotrade_token');
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ currentPassword: oldPass, newPassword: credPass }),
      });
      const body = await r.json();
      if (!r.ok) { setCredMsg({ type: 'err', text: body.error || 'Failed to update password.' }); return; }
      setOldPass(''); setCredPass(''); setCredConfirm(''); setShowPwdForm(false);
      setCredMsg({ type: 'ok', text: 'Password updated successfully.' });
    } catch {
      setCredMsg({ type: 'err', text: 'Network error. Please try again.' });
    }
  }

  useEffect(() => {
    getNumberSeries().then(setSeries);
    getCompanySettings().then(settings => {
      if (Object.keys(settings).length > 0) {
        setData({
          company_name:      settings.company_name      || '',
          organization_type: settings.organization_type || '',
          slug:              settings.slug               || '',
          address:           settings.address            || '',
          country:           settings.country            || '',
          city:              settings.city               || '',
          state:             settings.state              || '',
          zip:               settings.zip                || '',
          email:             settings.email              || '',
          contact_person:    settings.contact_person     || '',
          phone:             settings.phone              || '',
          fax:               settings.fax                || '',
          ntn:               settings.ntn                || '',
          cnic:              settings.cnic               || '',
        });
      }
    }).catch(() => {});
    const imgs = localStorage.getItem(IMAGES_KEY);
    if (imgs) {
      try {
        const { profile, signature } = JSON.parse(imgs);
        if (profile)   setProfileImage(profile);
        if (signature) setSignatureImage(signature);
      } catch {}
    }
  }, []);

  function handleImageSelect(inputRef: React.RefObject<HTMLInputElement>, setImage: (v: string | null) => void) {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function setField(key: keyof CompanyData, value: string) {
    setData(d => ({ ...d, [key]: value }));
    setFieldErrors(errs => ({ ...errs, [key]: validateField(key, value) }));
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault(); setInfoError(''); setInfoSaving(true); setInfoSaved(false);

    const validationKeys: (keyof CompanyData)[] = ['ntn', 'cnic', 'phone', 'fax', 'zip', 'city', 'state'];
    const errs: Partial<Record<keyof CompanyData, string>> = {};
    validationKeys.forEach(k => { const msg = validateField(k, data[k]); if (msg) errs[k] = msg; });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setInfoError('Please fix the highlighted fields before saving.');
      setInfoSaving(false);
      return;
    }

    try {
      await updateCompanySettings({ ...data } as Record<string, string>);
      localStorage.setItem(IMAGES_KEY, JSON.stringify({ profile: profileImage || null, signature: signatureImage || null }));
      setInfoSaved(true); setTimeout(() => setInfoSaved(false), 4000);
    } catch (err: unknown) { setInfoError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setInfoSaving(false); }
  }

  async function saveSeries(s: Series) {
    try { await updateNumberSeries(s.prefix, { next_number: s.next_number, padding: s.padding }); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Save failed'); }
  }

  function updSeries(prefix: string, patch: Partial<Series>) {
    setSeries(prev => prev.map(s => s.prefix !== prefix ? s : { ...s, ...patch }));
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  const TABS: { key: Tab; label: string }[] = [
    { key: 'information',      label: 'Information' },
    { key: 'numbering',        label: 'Number Series' },
    { key: 'categories',       label: 'Categories' },
    { key: 'adjustment-types', label: 'Adjustment Types' },
    { key: 'crm-masters',      label: 'CRM Masters' },
    { key: 'taxes',            label: 'Taxes' },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Setup</h1>
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap -mb-px border-b-2 transition-colors ${tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'information' && (
        <form onSubmit={saveInfo} className="flex gap-8 max-w-6xl">
          {/* Left — image uploads */}
          <div className="w-48 flex-shrink-0 space-y-6">
            {/* Company Logo */}
            <div className="text-center">
              <div className="relative w-40 mx-auto">
                <div onClick={() => profileInputRef.current?.click()}
                  className="w-40 h-28 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden">
                  {profileImage
                    ? <img src={profileImage} alt="Logo" className="w-full h-full object-contain p-1" />
                    : <div className="text-center">
                        <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-xs text-gray-500">Upload Logo</span>
                      </div>}
                </div>
                {profileImage && (
                  <button type="button"
                    onClick={() => { setProfileImage(null); if (profileInputRef.current) profileInputRef.current.value = ''; }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-10"
                    title="Remove logo">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <input ref={profileInputRef} type="file" accept="image/*" className="hidden"
                onChange={() => handleImageSelect(profileInputRef, setProfileImage)} />
              <p className="text-xs text-gray-500 mt-1.5">Company Logo</p>
              {profileImage && (
                <button type="button"
                  onClick={() => { setProfileImage(null); if (profileInputRef.current) profileInputRef.current.value = ''; }}
                  className="mt-0.5 text-xs text-red-500 hover:text-red-700 underline">
                  Remove
                </button>
              )}
            </div>

            {/* Signature */}
            <div className="text-center">
              <div className="relative w-40 mx-auto">
                <div onClick={() => signatureInputRef.current?.click()}
                  className="w-40 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden">
                  {signatureImage
                    ? <img src={signatureImage} alt="Signature" className="w-full h-full object-contain p-1" />
                    : <div className="text-center">
                        <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-xs text-gray-500">Upload Signature</span>
                      </div>}
                </div>
                {signatureImage && (
                  <button type="button"
                    onClick={() => { setSignatureImage(null); if (signatureInputRef.current) signatureInputRef.current.value = ''; }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-10"
                    title="Remove signature">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <input ref={signatureInputRef} type="file" accept="image/*" className="hidden"
                onChange={() => handleImageSelect(signatureInputRef, setSignatureImage)} />
              <p className="text-xs text-gray-500 mt-2">Signature</p>
              {signatureImage && (
                <button type="button"
                  onClick={() => { setSignatureImage(null); if (signatureInputRef.current) signatureInputRef.current.value = ''; }}
                  className="mt-1 text-xs text-red-500 hover:text-red-700 underline">
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Right — form */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              {infoError && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{infoError}</div>}
              {infoSaved && (
                <div className="flex items-center gap-2 rounded bg-green-50 border border-green-200 p-3 text-sm font-medium text-green-700">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Settings updated successfully.
                </div>
              )}

              <div>
                <label className={labelCls}>Company Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Company Name" className={inputCls}
                  value={data.company_name} onChange={e => setData({ ...data, company_name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type of Organization <span className="text-red-500">*</span></label>
                  <select className={inputCls} value={data.organization_type} onChange={e => setData({ ...data, organization_type: e.target.value })}>
                    <option value="">-Choose-</option>
                    <option value="sole_proprietor">Sole Proprietor</option>
                    <option value="partnership">Partnership</option>
                    <option value="company">Company</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Slug <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Slug" className={inputCls}
                    value={data.slug} onChange={e => setData({ ...data, slug: e.target.value })} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Address <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Street Address" className={inputCls}
                  value={data.address} onChange={e => setData({ ...data, address: e.target.value })} />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Country</label>
                  <select className={inputCls} value={data.country} onChange={e => setData({ ...data, country: e.target.value })}>
                    <option value="">-Choose-</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="UAE">UAE</option>
                    <option value="USA">USA</option>
                    <option value="UK">UK</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  {data.country === 'Pakistan' ? (
                    <select className={inputCls} value={data.city} onChange={e => setField('city', e.target.value)}>
                      <option value="">-Choose-</option>
                      {PK_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" placeholder="City" className={inputCls}
                      value={data.city} onChange={e => setField('city', e.target.value)} />
                  )}
                  {fieldErrors.city && <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>}
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  {data.country === 'Pakistan' ? (
                    <select className={inputCls} value={data.state} onChange={e => setField('state', e.target.value)}>
                      <option value="">-Choose-</option>
                      {PK_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input type="text" placeholder="State" className={inputCls}
                      value={data.state} onChange={e => setField('state', e.target.value)} />
                  )}
                  {fieldErrors.state && <p className="text-xs text-red-500 mt-1">{fieldErrors.state}</p>}
                </div>
                <div>
                  <label className={labelCls}>Zip</label>
                  <input type="text" placeholder="Zip" className={inputCls}
                    value={data.zip} onChange={e => setField('zip', e.target.value)} />
                  {fieldErrors.zip && <p className="text-xs text-red-500 mt-1">{fieldErrors.zip}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" placeholder="Email" className={inputCls}
                    value={data.email} onChange={e => setData({ ...data, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Contact Person</label>
                  <input type="text" placeholder="Contact Person" className={inputCls}
                    value={data.contact_person} onChange={e => setData({ ...data, contact_person: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" placeholder="e.g. +92 21 1234567" className={inputCls}
                    value={data.phone} onChange={e => setField('phone', e.target.value)} />
                  {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label className={labelCls}>Fax</label>
                  <input type="tel" placeholder="e.g. +92 21 1234567" className={inputCls}
                    value={data.fax} onChange={e => setField('fax', e.target.value)} />
                  {fieldErrors.fax && <p className="text-xs text-red-500 mt-1">{fieldErrors.fax}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls + ' text-green-600'}>NTN <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. 1234567-8" className={inputCls}
                    value={data.ntn} onChange={e => setField('ntn', e.target.value)} />
                  {fieldErrors.ntn && <p className="text-xs text-red-500 mt-1">{fieldErrors.ntn}</p>}
                </div>
                <div>
                  <label className={labelCls + ' text-green-600'}>CNIC <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. 12345-1234567-1" className={inputCls}
                    value={data.cnic} onChange={e => setField('cnic', e.target.value)} />
                  {fieldErrors.cnic && <p className="text-xs text-red-500 mt-1">{fieldErrors.cnic}</p>}
                </div>
              </div>

              {/* ── Button Color ── */}
              <div className="border-t border-gray-100 pt-5 mt-2">
                <label className={labelCls}>Button Color</label>
                <p className="text-xs text-gray-500 mb-3">Choose an accent colour for the action buttons across the app. Applies instantly.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {BTN_PRESETS.map(c => (
                    <button key={c} type="button" onClick={() => pickButtonColor(c)} title={c}
                      className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: btnColor?.toLowerCase() === c ? '#111827' : 'transparent' }} />
                  ))}
                  <label className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer relative text-gray-400 hover:text-gray-600" title="Custom colour">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <input type="color" value={btnColor || '#2563eb'} onChange={e => pickButtonColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer" />
                  </label>
                  <button type="button" onClick={() => pickButtonColor(null)}
                    className="ml-2 text-xs font-medium text-gray-500 hover:text-gray-700 underline">
                    Reset to default
                  </button>
                </div>
              </div>

              {/* ── Login Credentials ── */}
              <div className="border-t border-gray-100 pt-5 mt-2">
                <label className={labelCls}>Login Credentials</label>
                <p className="text-xs text-gray-500 mb-3">Set the ID and password used to log in to the software.</p>

                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
                    <input type="text" value={credId} onChange={e => { setCredId(e.target.value); setCredMsg(null); }}
                      placeholder="e.g. you@email.com" className={inputCls} />
                  </div>
                  <div>
                    <button type="button" onClick={saveId}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors">
                      Update ID
                    </button>
                  </div>
                </div>

                {!showPwdForm ? (
                  <button type="button" onClick={() => { setShowPwdForm(true); setOldPass(''); setCredPass(''); setCredConfirm(''); setShowOldPass(false); setShowCredPass(false); setCredMsg(null); }}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors">
                    Update Password
                  </button>
                ) : (
                  <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                        <div className="relative">
                          <input key="current-pwd" type={showOldPass ? 'text' : 'password'} value={oldPass}
                            onChange={e => { setOldPass(e.target.value); setCredMsg(null); }}
                            placeholder="Enter your current password" autoComplete="new-password"
                            className={inputCls + ' pr-10'} />
                          <button type="button" onClick={() => setShowOldPass(v => !v)} title={showOldPass ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showOldPass ? (
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" /></svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div />
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                        <div className="relative">
                          <input key="new-pwd" type={showCredPass ? 'text' : 'password'} value={credPass}
                            onChange={e => { setCredPass(e.target.value); setCredMsg(null); }}
                            placeholder="New password" autoComplete="new-password"
                            className={inputCls + ' pr-10'} />
                          <button type="button" onClick={() => setShowCredPass(v => !v)} title={showCredPass ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showCredPass ? (
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" /></svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                        <input key="confirm-pwd" type={showCredPass ? 'text' : 'password'} value={credConfirm}
                          onChange={e => { setCredConfirm(e.target.value); setCredMsg(null); }}
                          placeholder="Confirm new password" autoComplete="new-password"
                          className={inputCls} />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={savePassword}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors">
                        Save Password
                      </button>
                      <button type="button" onClick={() => { setShowPwdForm(false); setOldPass(''); setCredPass(''); setCredConfirm(''); setCredMsg(null); }}
                        className="border border-gray-300 text-gray-600 px-5 py-2 rounded text-sm font-semibold hover:bg-gray-100 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {credMsg && <p className={`text-xs mt-2 ${credMsg.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{credMsg.text}</p>}
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={infoSaving}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50">
                  {infoSaving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {tab === 'numbering' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="table-th">Prefix</th>
              <th className="table-th w-36">Next Number</th>
              <th className="table-th w-24">Padding</th>
              <th className="table-th w-32">Preview</th>
              <th className="table-th w-16"></th>
            </tr></thead>
            <tbody>
              {series.map(s => (
                <tr key={s.prefix} className="border-b hover:bg-gray-50">
                  <td className="table-td"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{s.prefix}</code></td>
                  <td className="table-td"><input type="number" min="1" className="input py-1 text-xs" value={s.next_number} onChange={e => updSeries(s.prefix, { next_number: Number(e.target.value) })} /></td>
                  <td className="table-td"><input type="number" min="1" max="12" className="input py-1 text-xs" value={s.padding} onChange={e => updSeries(s.prefix, { padding: Number(e.target.value) })} /></td>
                  <td className="table-td text-xs text-gray-500">{s.prefix}{String(s.next_number).padStart(s.padding, '0')}</td>
                  <td className="table-td text-right">
                    <button onClick={() => saveSeries(s)} className="text-xs text-brand-600 hover:underline">Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-2 gap-4">
          <SimpleListEditor title="Customer Categories" endpoint="customer-categories" />
          <SimpleListEditor title="Vendor Categories" endpoint="vendor-categories" />
          <SimpleListEditor title="Product Categories" endpoint="product-categories" />
          <SimpleListEditor title="Brands" endpoint="brands" />
        </div>
      )}

      {tab === 'adjustment-types' && <AdjustmentTypesTab />}

      {tab === 'crm-masters' && (
        <div className="grid grid-cols-2 gap-4">
          <SimpleListEditor title="Lead Sources" endpoint="crm-masters/lead-sources" />
          <SimpleListEditor title="Industries" endpoint="crm-masters/industries" />
          <SimpleListEditor title="Ticket Tags" endpoint="crm-masters/ticket-tags"
            extraFields={[{ key: 'color', label: 'Color', type: 'color' }]} />
          <SimpleListEditor title="Event Types" endpoint="crm-masters/event-types"
            extraFields={[{ key: 'color', label: 'Color', type: 'color' }]} />
          <div className="col-span-2">
            <SimpleListEditor title="Lead Statuses" endpoint="crm-masters/lead-statuses"
              extraFields={[
                { key: 'color', label: 'Color', type: 'color' },
              ]} />
          </div>
        </div>
      )}

      {tab === 'taxes' && <TaxesTab />}
    </div>
  );
}
