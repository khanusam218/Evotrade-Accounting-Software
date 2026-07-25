import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyButtonColor } from './theme';

// Apply the user's saved button accent colour before first paint
applyButtonColor();

// Inject X-Company-ID header into every /api fetch call
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const _orig = window.fetch.bind(window);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.href
          : typeof (input as Request).url === 'string'
          ? (input as Request).url
          : '';
      if (url.startsWith('/api')) {
        let id = 'evotrade';
        try { id = JSON.parse(localStorage.getItem('evotrade_active_business') || '{}').id || 'evotrade'; } catch { /* */ }
        const h = new Headers(init?.headers);
        h.set('X-Company-ID', id);
        return _orig(input, { ...init, headers: h });
      }
    } catch { /* fall through */ }
    return _orig(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
