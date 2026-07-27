import type { Invoice } from '../types';
import { http } from './client';

export interface InvoiceListFilters {
  status?: string;
  glCodeId?: string;
  contractId?: string;
  vendor?: string;
  search?: string;
}

export interface InvoiceInput {
  invoiceNumber: string;
  vendor?: string | null;
  amount: number;
  status?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  glCodeId?: string | null;
  contractId?: string | null;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&')}`;
}

export const invoicesApi = {
  list: (filters: InvoiceListFilters = {}) =>
    http.get<Invoice[]>(`/invoices${qs(filters as Record<string, string | undefined>)}`),
  get: (id: string) => http.get<Invoice>(`/invoices/${id}`),
  create: (input: InvoiceInput) => http.post<Invoice>('/invoices', input),
  update: (id: string, input: Partial<InvoiceInput>) => http.patch<Invoice>(`/invoices/${id}`, input),
  remove: (id: string) => http.delete(`/invoices/${id}`),
};
