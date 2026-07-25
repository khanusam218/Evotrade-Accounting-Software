import { apiFetch, parseJsonOrThrow } from './apiFetch';

export async function getDashboard() {
  return apiFetch('/api/dashboard').then(parseJsonOrThrow);
}

export async function getSalesChart(): Promise<{ month: string; amount: string }[]> {
  return apiFetch('/api/dashboard/sales-chart').then(parseJsonOrThrow) as Promise<{ month: string; amount: string }[]>;
}

export async function getTopCustomers(): Promise<{ customer_name: string; total_revenue: string }[]> {
  return apiFetch('/api/dashboard/top-customers').then(parseJsonOrThrow) as Promise<{ customer_name: string; total_revenue: string }[]>;
}
