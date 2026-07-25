// Custom button accent colour, chosen in Setup → Information → Button Color.
// Stored in localStorage and applied app-wide via a CSS variable + a root class
// that the override rules in index.css key off of.
// Key is scoped per user so each account has its own colour.

const BASE_KEY = 'evotrade_button_color';

function getKey(): string {
  try {
    const userId = localStorage.getItem('evotrade_current_id');
    return userId ? `${BASE_KEY}_${userId}` : BASE_KEY;
  } catch {
    return BASE_KEY;
  }
}

function darken(hex: string, amt = 24): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const r = Math.max(0, ((n >> 16) & 255) - amt);
  const g = Math.max(0, ((n >> 8) & 255) - amt);
  const b = Math.max(0, (n & 255) - amt);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Apply the saved button colour (or clear it) to the document root. */
export function applyButtonColor() {
  const root = document.documentElement;
  let c: string | null = null;
  try { c = localStorage.getItem(getKey()); } catch { /* */ }
  if (c) {
    root.style.setProperty('--btn-accent', c);
    root.style.setProperty('--btn-accent-hover', darken(c));
    root.classList.add('btn-themed');
  } else {
    root.style.removeProperty('--btn-accent');
    root.style.removeProperty('--btn-accent-hover');
    root.classList.remove('btn-themed');
  }
}

/** Persist a button colour (or null to reset to the default theme) and apply it. */
export function setButtonColor(color: string | null) {
  try {
    if (color) localStorage.setItem(getKey(), color);
    else localStorage.removeItem(getKey());
  } catch { /* */ }
  applyButtonColor();
}

export function getButtonColor(): string | null {
  try { return localStorage.getItem(getKey()); } catch { return null; }
}
