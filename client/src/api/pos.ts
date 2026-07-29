import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { POSCounter, POSSession, POSTransaction, POSTransactionLine } from '../types/pos';

const BASE = '/api/pos';
const CB   = '/api/pos-counters';

const j = <T>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;

const post = <T>(url: string, data?: unknown): Promise<T> =>
  apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(j<T>);

const put = <T>(url: string, data?: unknown): Promise<T> =>
  apiFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(j<T>);

// ─── Counters ────────────────────────────────────────────────────────────────
export const getCounters   = (): Promise<POSCounter[]>             => apiFetch(CB).then(j<POSCounter[]>);
export const getCounter    = (id: number): Promise<POSCounter>     => apiFetch(`${CB}/${id}`).then(j<POSCounter>);
export const createCounter = (d: Partial<POSCounter>): Promise<POSCounter> => post<POSCounter>(CB, d);
export const updateCounter = (id: number, d: Partial<POSCounter>): Promise<POSCounter> => put<POSCounter>(`${CB}/${id}`, d);
export const deleteCounter = (id: number): Promise<void>           => apiFetch(`${CB}/${id}`, { method: 'DELETE' }).then(j<void>);

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const getSessions    = (): Promise<POSSession[]>            => apiFetch(`${BASE}/sessions`).then(j<POSSession[]>);
export const getOpenSession = (): Promise<POSSession | null>       => apiFetch(`${BASE}/sessions/open`).then(j<POSSession | null>);
export const getSession     = (id: number): Promise<POSSession>    => apiFetch(`${BASE}/sessions/${id}`).then(j<POSSession>);
export const openSession    = (d: { opening_balance: number; counter_id?: number; warehouse_id?: number; notes?: string }): Promise<POSSession> =>
  post<POSSession>(`${BASE}/sessions`, d);
export const closeSession   = (id: number, d: { closing_balance: number }): Promise<POSSession> =>
  post<POSSession>(`${BASE}/sessions/${id}/close`, d);

// ─── Transactions ─────────────────────────────────────────────────────────────
export const getTransactions   = (p?: Record<string, string>): Promise<POSTransaction[]> =>
  apiFetch(`${BASE}/transactions` + (p ? '?' + new URLSearchParams(p) : '')).then(j<POSTransaction[]>);
export const getTransaction    = (id: number): Promise<POSTransaction>    => apiFetch(`${BASE}/transactions/${id}`).then(j<POSTransaction>);
export const createTransaction = (d: Partial<POSTransaction>): Promise<POSTransaction> => post<POSTransaction>(`${BASE}/transactions`, d);
export const voidTransaction   = (id: number): Promise<POSTransaction>    =>
  apiFetch(`${BASE}/transactions/${id}/void`, { method: 'POST' }).then(j<POSTransaction>);
export const createReturn = (originalId: number, d: {
  session_id: number; payment_mode?: string; notes?: string; lines: POSTransactionLine[];
}): Promise<POSTransaction> => post<POSTransaction>(`${BASE}/transactions/${originalId}/return`, d);

// ─── Cash movements (Cash In / Cash Out) ─────────────────────────────────────
export interface POSCashMovement {
  id: number;
  session_id: number;
  movement_type: 'cash_in' | 'cash_out';
  from_account_id: number;
  to_account_id: number;
  amount: number;
  comments: string | null;
  created_at: string;
}
export const createCashMovement = (d: {
  session_id: number; movement_type: 'cash_in' | 'cash_out';
  from_account_id: number; to_account_id: number; amount: number; comments?: string;
}): Promise<POSCashMovement> => post<POSCashMovement>(`${BASE}/cash-movements`, d);

// ─── Summaries ────────────────────────────────────────────────────────────────
export const getSessionSummary      = (sessionId: number)                => apiFetch(`${BASE}/sessions/${sessionId}/summary`).then(j);
export const getCounterDailySummary = (counterId: number, date?: string) =>
  apiFetch(`${BASE}/counters/${counterId}/daily-summary` + (date ? `?date=${date}` : '')).then(j);
