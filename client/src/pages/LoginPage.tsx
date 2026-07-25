import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { applyButtonColor } from '../theme';

interface Business {
  id: string;
  name: string;
  type: string;
  color: string;
  initials: string;
  createdAt: string;
  isNew?: boolean;
}

const ACTIVE_KEY  = 'evotrade_active_business';
const AUTH_KEY    = 'evotrade_token';
const CURRENT_ID_KEY = 'evotrade_current_id';

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#059669', '#0891b2', '#4f46e5',
  '#c026d3', '#0d9488', '#ea580c', '#65a30d',
];

const BUSINESS_TYPES = [
  'Retail', 'Wholesale', 'Trading', 'Manufacturing',
  'Services', 'Import / Export', 'E-Commerce', 'Other',
];

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function getStorageKey(userId: string) {
  return `evotrade_businesses_${userId}`;
}

// ── Create Business Modal ─────────────────────────────────────────────────────

interface CreateProps {
  onClose: () => void;
  onCreate: (biz: Business) => void;
}

function CreateBusinessModal({ onClose, onCreate }: CreateProps) {
  const [name,  setName]  = useState('');
  const [type,  setType]  = useState('Retail');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Business name is required'); return; }
    onCreate({
      id: crypto.randomUUID(),
      name: name.trim(),
      type,
      color,
      initials: getInitials(name),
      createdAt: new Date().toISOString(),
      isNew: true,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Create New Business</h3>
            <p className="text-xs text-gray-400 mt-0.5">Set up your business profile</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Avatar preview */}
          <div className="flex justify-center">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg transition-colors"
              style={{ backgroundColor: color }}
            >
              {name ? getInitials(name) : '?'}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business Name *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Evotrade Pvt Ltd"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Avatar Color</label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-lg transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >Cancel</button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg"
            >Create Business</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Import Business Modal ─────────────────────────────────────────────────────

interface ImportProps {
  onClose: () => void;
  onImport: (biz: Business) => void;
}

function ImportBusinessModal({ onClose, onImport }: ImportProps) {
  const [dragging, setDragging] = useState(false);
  const [preview,  setPreview]  = useState<Business | null>(null);
  const [error,    setError]    = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.name) throw new Error('Missing business name');
        setPreview({
          id:        crypto.randomUUID(),
          name:      data.name,
          type:      data.type      || 'Business',
          color:     data.color     || AVATAR_COLORS[0],
          initials:  getInitials(data.name),
          createdAt: data.createdAt || new Date().toISOString(),
        });
        setError('');
      } catch {
        setError('Invalid file format. Please use a valid Evotrade business backup (.json).');
        setPreview(null);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Import Business</h3>
            <p className="text-xs text-gray-400 mt-0.5">Restore from a backup file</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-all ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <svg className="h-10 w-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">Drop file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports .json backup files</p>
            <input
              ref={inputRef} type="file" accept=".json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}

          {preview && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow shrink-0"
                style={{ backgroundColor: preview.color }}
              >{preview.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{preview.name}</div>
                <div className="text-xs text-gray-500">{preview.type}</div>
              </div>
              <svg className="h-5 w-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >Cancel</button>
            <button
              onClick={() => preview && onImport(preview)}
              disabled={!preview}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg"
            >Import Business</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Business Card ─────────────────────────────────────────────────────────────

function BusinessCard({ biz, removeMode, onSelect, onRemove }: {
  biz: Business;
  removeMode: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-2xl p-5 select-none transition-all group ${
        removeMode
          ? 'cursor-default opacity-90 ring-2 ring-red-400'
          : 'cursor-pointer hover:-translate-y-1 hover:scale-[1.02]'
      }`}
      style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {removeMode && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2.5 -right-2.5 h-7 w-7 bg-red-600 text-white rounded-full flex items-center justify-center text-base font-bold shadow-lg hover:bg-red-700 z-10 leading-none transition-colors"
        >×</button>
      )}

      {/* Avatar */}
      <div
        className="h-13 w-13 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-md"
        style={{ backgroundColor: biz.color, width: 52, height: 52 }}
      >{biz.initials}</div>

      <div className="font-bold text-white text-sm leading-tight mb-1 truncate">{biz.name}</div>
      <div className="text-xs text-blue-200 mb-2">{biz.type}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-xs text-slate-400">{new Date(biz.createdAt).toLocaleDateString()}</div>
        {biz.isNew && (
          <span className="text-xs bg-amber-500 text-white font-semibold px-2 py-0.5 rounded-full">Setup</span>
        )}
      </div>

      {!removeMode && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-blue-400 transition-all pointer-events-none" style={{ boxShadow: 'none' }} />
      )}
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search,     setSearch]     = useState('');
  const [removeMode, setRemoveMode] = useState(false);
  const [showAddDd,  setShowAddDd]  = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loggedOut,  setLoggedOut]  = useState(false);
  const [authed,     setAuthed]     = useState(() => {
    try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; }
  });
  const [currentUserId, setCurrentUserId] = useState(() => {
    try { return localStorage.getItem(CURRENT_ID_KEY) || ''; } catch { return ''; }
  });
  const [authId,     setAuthId]     = useState('');
  const [authPass,   setAuthPass]   = useState('');
  const [authErr,    setAuthErr]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [signupId,   setSignupId]   = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupConf, setSignupConf] = useState('');
  const [signupErr,  setSignupErr]  = useState('');
  const [showSPass,  setShowSPass]  = useState(false);
  const [showSConf,  setShowSConf]  = useState(false);
  const [isNewSignup, setIsNewSignup] = useState(false);
  const addDdRef = useRef<HTMLDivElement>(null);
  const loginIdRef = useRef<HTMLInputElement>(null);
  const loginPassRef = useRef<HTMLInputElement>(null);
  const signupIdRef = useRef<HTMLInputElement>(null);
  const signupPassRef = useRef<HTMLInputElement>(null);
  const signupConfRef = useRef<HTMLInputElement>(null);

  function logout() {
    // Fully end the session: clear auth + active business so logging back in always
    // requires the ID & password again.
    try { localStorage.removeItem(ACTIVE_KEY); localStorage.removeItem(AUTH_KEY); localStorage.removeItem(CURRENT_ID_KEY); } catch {}
    applyButtonColor();
    setCurrentUserId('');
    setAuthId('');
    setAuthPass('');
    setAuthErr('');
    setAuthed(false);
    setLoggedOut(true);
  }

  async function handleLogin() {
    setAuthErr('');
    const userId = authId.trim();
    if (!userId || !authPass) {
      setAuthErr('ID and password are required');
      return;
    }

    try {
      const response = await axios.post('/api/auth/login', {
        id: userId,
        password: authPass,
      });

      // Store JWT token
      const { token } = response.data;
      localStorage.setItem(AUTH_KEY, token);
      localStorage.setItem(CURRENT_ID_KEY, userId);
      applyButtonColor();

      setAuthId('');
      setAuthPass('');
      setCurrentUserId(userId);
      setAuthed(true);
      setLoggedOut(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Invalid ID or password';
      setAuthErr(msg);
    }
  }

  async function handleSignup() {
    setSignupErr('');
    if (!signupId.trim()) { setSignupErr('ID is required.'); return; }
    if (signupId.trim().length < 3) { setSignupErr('ID must be at least 3 characters.'); return; }
    if (!signupPass) { setSignupErr('Password is required.'); return; }
    if (signupPass.length < 6) { setSignupErr('Password must be at least 6 characters.'); return; }
    if (signupPass !== signupConf) { setSignupErr('Passwords do not match.'); return; }

    const trimmedId = signupId.trim();

    try {
      const response = await axios.post('/api/auth/register', {
        id: trimmedId,
        password: signupPass,
        confirmPassword: signupConf,
      });

      // Store JWT token
      const { token } = response.data;
      localStorage.setItem(AUTH_KEY, token);
      localStorage.setItem(CURRENT_ID_KEY, trimmedId);
      applyButtonColor();

      setCurrentUserId(trimmedId);
      setSignupId('');
      setSignupPass('');
      setSignupConf('');
      setShowSignup(false);
      setIsNewSignup(true);
      setAuthed(true);
      setLoggedOut(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create account';
      setSignupErr(msg);
    }
  }

  useEffect(() => {
    if (currentUserId) {
      try {
        const saved = localStorage.getItem(getStorageKey(currentUserId));
        if (saved) setBusinesses(JSON.parse(saved));
        else setBusinesses([]);
      } catch {}
    }
  }, [currentUserId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (addDdRef.current && !addDdRef.current.contains(e.target as Node)) setShowAddDd(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (isNewSignup && businesses.length === 0) {
      setShowCreate(true);
      setIsNewSignup(false);
    }
  }, [isNewSignup, businesses.length]);

  // Clear form fields when showing login/logout screens
  useEffect(() => {
    if (!authed) {
      setAuthId('');
      setAuthPass('');
      setAuthErr('');
      setShowSignup(false);
      setSignupId('');
      setSignupPass('');
      setSignupConf('');
      setSignupErr('');

      // Directly clear DOM input values to override browser autocomplete
      setTimeout(() => {
        if (loginIdRef.current) {
          loginIdRef.current.value = '';
          loginIdRef.current.defaultValue = '';
        }
        if (loginPassRef.current) {
          loginPassRef.current.value = '';
          loginPassRef.current.defaultValue = '';
        }
        if (signupIdRef.current) {
          signupIdRef.current.value = '';
          signupIdRef.current.defaultValue = '';
        }
        if (signupPassRef.current) {
          signupPassRef.current.value = '';
          signupPassRef.current.defaultValue = '';
        }
        if (signupConfRef.current) {
          signupConfRef.current.value = '';
          signupConfRef.current.defaultValue = '';
        }
      }, 0);
    }
  }, [authed]);

  function persist(list: Business[]) {
    setBusinesses(list);
    if (currentUserId) {
      try {
        localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(list));
      } catch {}
    }
  }

  function selectBusiness(biz: Business) {
    if (removeMode) return;
    if (biz.isNew) {
      // Mark as no longer new, then send to setup
      const updated = { ...biz, isNew: false };
      persist(businesses.map(b => b.id === biz.id ? updated : b));
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(updated));
      navigate('/setup');
    } else {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(biz));
      navigate('/dashboard');
    }
  }

  function removeBusiness(id: string) {
    persist(businesses.filter(b => b.id !== id));
    try {
      const active = JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}');
      if (active.id === id) localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.type.toLowerCase().includes(search.toLowerCase())
  );

  if (!authed && !loggedOut) {
    if (showSignup) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a6b 50%, #0f2744 100%)' }}>
          <form key={`signup-form-${showSignup}`} onSubmit={(e) => { e.preventDefault(); handleSignup(); }}
            className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-14 w-14 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg">
                <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-white text-center mb-1">Create Account</h1>
            <p className="text-slate-400 text-sm text-center mb-6">Set up your credentials to get started</p>

            <label className="block text-xs font-semibold text-slate-300 mb-1.5">ID</label>
            <input ref={signupIdRef} value={signupId} onChange={e => { setSignupId(e.target.value); setSignupErr(''); }} placeholder="Choose an ID (3+ characters)" autoFocus autoComplete="off"
              className="w-full bg-white/10 text-white placeholder-slate-400 border border-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400 mb-4" />

            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative mb-4">
              <input ref={signupPassRef} type={showSPass ? 'text' : 'password'} value={signupPass} onChange={e => { setSignupPass(e.target.value); setSignupErr(''); }} placeholder="Create a password (6+ characters)" autoComplete="new-password"
                className="w-full bg-white/10 text-white placeholder-slate-400 border border-white/20 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:border-green-400" />
              <button type="button" onClick={() => setShowSPass(v => !v)} title={showSPass ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showSPass ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password</label>
            <div className="relative mb-4">
              <input ref={signupConfRef} type={showSConf ? 'text' : 'password'} value={signupConf} onChange={e => { setSignupConf(e.target.value); setSignupErr(''); }} placeholder="Confirm your password" autoComplete="new-password"
                className="w-full bg-white/10 text-white placeholder-slate-400 border border-white/20 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:border-green-400" />
              <button type="button" onClick={() => setShowSConf(v => !v)} title={showSConf ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showSConf ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {signupErr && <p className="text-red-400 text-xs mb-4">{signupErr}</p>}

            <button type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors shadow-lg">
              Create Account
            </button>
            <button type="button" onClick={() => { setShowSignup(false); setSignupErr(''); }}
              className="w-full mt-3 text-slate-400 hover:text-white text-sm transition-colors">
              Back to Log In
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a6b 50%, #0f2744 100%)' }}>
        <form key={`login-form-${authed}`} onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
          className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-5">
            <div className="h-14 w-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white text-center mb-1">Log In</h1>
          <p className="text-slate-400 text-sm text-center mb-6">Enter your ID and password to continue</p>

          <label className="block text-xs font-semibold text-slate-300 mb-1.5">ID</label>
          <input ref={loginIdRef} value={authId} onChange={e => { setAuthId(e.target.value); setAuthErr(''); }} placeholder="Enter ID" autoFocus autoComplete="off"
            className="w-full bg-white/10 text-white placeholder-slate-400 border border-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 mb-4" />

          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
          <div className="relative">
            <input ref={loginPassRef} type={showPass ? 'text' : 'password'} value={authPass} onChange={e => { setAuthPass(e.target.value); setAuthErr(''); }} placeholder="Enter password" autoComplete="new-password"
              className="w-full bg-white/10 text-white placeholder-slate-400 border border-white/20 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:border-blue-400" />
            <button type="button" onClick={() => setShowPass(v => !v)} title={showPass ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              {showPass ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {authErr && <p className="text-red-400 text-xs mt-3">{authErr}</p>}

          <button type="submit"
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors shadow-lg">
            Log In
          </button>
          <button type="button" onClick={() => setShowSignup(true)}
            className="w-full mt-3 text-slate-400 hover:text-white text-sm transition-colors">
            Don't have an account? Sign Up
          </button>
          <button type="button" onClick={() => { setAuthId(''); setAuthPass(''); setAuthErr(''); setLoggedOut(true); }}
            className="w-full mt-2 text-slate-400 hover:text-white text-sm transition-colors">
            Back
          </button>
        </form>
      </div>
    );
  }

  if (loggedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a6b 50%, #0f2744 100%)' }}>
        <div className="h-16 w-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg mb-6">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">You have been logged out</h1>
        <p className="text-slate-400 text-sm mb-8">You can close this window or log back in.</p>
        <button onClick={() => { setAuthId(''); setAuthPass(''); setAuthErr(''); setLoggedOut(false); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl shadow-lg transition-colors">
          Log Back In
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a6b 50%, #0f2744 100%)' }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shrink-0">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight leading-none">Evotrade</div>
            <div className="text-xs text-blue-300 mt-0.5">Accounting Software</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-xs text-slate-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <button onClick={logout} title="Logout"
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="text-center mt-8 mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Select Your Business</h1>
        <p className="text-slate-400 text-sm">Choose a business to continue, or add a new one</p>
      </div>

      {/* ── Controls ── */}
      <div className="max-w-4xl mx-auto w-full px-6 mb-6">
        <div className="flex items-center gap-3">

          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search businesses..."
              className="w-full bg-white/10 text-white placeholder-slate-400 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none">&times;</button>
            )}
          </div>

          {/* Add Business dropdown */}
          <div className="relative shrink-0" ref={addDdRef}>
            <button
              onClick={() => setShowAddDd(v => !v)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Business
              <svg className={`h-3 w-3 transition-transform ${showAddDd ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {showAddDd && (
              <div className="absolute right-0 top-full mt-2 w-58 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-20" style={{ width: 232 }}>
                <button
                  onClick={() => { setShowAddDd(false); setShowCreate(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-blue-50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition-colors">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Create New Business</div>
                    <div className="text-xs text-gray-400">Start from scratch</div>
                  </div>
                </button>

                <div className="h-px bg-gray-100 mx-4" />

                <button
                  onClick={() => { setShowAddDd(false); setShowImport(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-green-50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-xl bg-green-100 group-hover:bg-green-200 flex items-center justify-center shrink-0 transition-colors">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Import Business</div>
                    <div className="text-xs text-gray-400">From backup file</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Remove Business toggle */}
          <button
            onClick={() => setRemoveMode(v => !v)}
            className={`shrink-0 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all ${
              removeMode
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30'
                : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {removeMode ? 'Done' : 'Remove Business'}
          </button>
        </div>

        {removeMode && (
          <p className="mt-2.5 text-xs text-red-300 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Click the × button on any card to remove that business
          </p>
        )}
      </div>

      {/* ── Business Cards Grid ── */}
      <div className="max-w-4xl mx-auto w-full px-6 flex-1">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            {businesses.length === 0 ? (
              <>
                <div className="h-20 w-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-white font-bold text-lg mb-1">No businesses yet</p>
                <p className="text-slate-400 text-sm">Click "Add Business" above to get started</p>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-white font-bold text-lg">No results for "{search}"</p>
                <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-10">
            {filtered.map(biz => (
              <BusinessCard
                key={biz.id}
                biz={biz}
                removeMode={removeMode}
                onSelect={() => selectBusiness(biz)}
                onRemove={() => removeBusiness(biz.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center py-5 mt-4">
        <p className="text-slate-600 text-xs">
          Evotrade Accounting Software &copy; {new Date().getFullYear()}
          &nbsp;&nbsp;·&nbsp;&nbsp;
          All data stored locally on this device
        </p>
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateBusinessModal
          onClose={() => setShowCreate(false)}
          onCreate={biz => { persist([...businesses, biz]); setShowCreate(false); }}
        />
      )}
      {showImport && (
        <ImportBusinessModal
          onClose={() => setShowImport(false)}
          onImport={biz => { persist([...businesses, biz]); setShowImport(false); }}
        />
      )}
    </div>
  );
}
