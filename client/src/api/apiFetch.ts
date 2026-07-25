export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('evotrade_token');
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...init, headers });
}

/** Parse response as JSON safely; falls back to text if body is not JSON. */
export async function parseJsonOrThrow(r: Response): Promise<unknown> {
  const text = await r.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { error: text || r.statusText }; }
  if (!r.ok) {
    const msg = (body as Record<string, string>)?.error || r.statusText || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return body;
}
