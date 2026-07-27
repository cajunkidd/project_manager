import type { Contract } from '../types';
import { http } from './client';

export interface ContractListFilters {
  status?: string;
  glCodeId?: string;
  vendor?: string;
  search?: string;
}

export interface ContractInput {
  contractNumber: string;
  title: string;
  vendor?: string | null;
  amount?: number | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  glCodeId?: string | null;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&')}`;
}

export const contractsApi = {
  list: (filters: ContractListFilters = {}) =>
    http.get<Contract[]>(`/contracts${qs(filters as Record<string, string | undefined>)}`),
  get: (id: string) => http.get<Contract>(`/contracts/${id}`),
  create: (input: ContractInput) => http.post<Contract>('/contracts', input),
  update: (id: string, input: Partial<ContractInput>) =>
    http.patch<Contract>(`/contracts/${id}`, input),
  remove: (id: string) => http.delete(`/contracts/${id}`),
};
