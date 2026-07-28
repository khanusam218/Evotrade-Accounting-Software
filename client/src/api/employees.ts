import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { Employee, Department, Designation, Project } from '../types/employee';

export async function getDepartments() {
  const r = await apiFetch('/api/departments');
  return parseJsonOrThrow(r) as Promise<Department[]>;
}

export async function createDepartment(data: Partial<Department>) {
  const r = await apiFetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Department>;
}

export async function updateDepartment(id: number, data: Partial<Department>) {
  const r = await apiFetch(`/api/departments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Department>;
}

export async function deleteDepartment(id: number) {
  const r = await apiFetch(`/api/departments/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r);
}

export async function getDesignations(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch('/api/designations' + q);
  return parseJsonOrThrow(r) as Promise<Designation[]>;
}

export async function createDesignation(data: Partial<Designation>) {
  const r = await apiFetch('/api/designations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Designation>;
}

export async function updateDesignation(id: number, data: Partial<Designation>) {
  const r = await apiFetch(`/api/designations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Designation>;
}

export async function deleteDesignation(id: number) {
  const r = await apiFetch(`/api/designations/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r);
}

export async function getEmployees(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch('/api/employees' + q);
  return parseJsonOrThrow(r) as Promise<Employee[]>;
}

export async function getEmployee(id: number) {
  const r = await apiFetch(`/api/employees/${id}`);
  return parseJsonOrThrow(r) as Promise<Employee>;
}

export async function createEmployee(data: Partial<Employee>) {
  const r = await apiFetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Employee>;
}

export async function updateEmployee(id: number, data: Partial<Employee>) {
  const r = await apiFetch(`/api/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Employee>;
}

export async function deleteEmployee(id: number) {
  const r = await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r);
}

export async function getProjects(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch('/api/projects' + q);
  return parseJsonOrThrow(r) as Promise<Project[]>;
}

export async function createProject(data: Partial<Project>) {
  const r = await apiFetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Project>;
}

export async function updateProject(id: number, data: Partial<Project>) {
  const r = await apiFetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<Project>;
}

export async function deleteProject(id: number) {
  const r = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r);
}


