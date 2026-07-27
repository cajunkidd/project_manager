import type { GLCode } from '../types';
import { http } from './client';

export interface GLCodeListFilters {
  category?: string;
  search?: string;
  active?: boolean;
}

export interface GLCodeInput {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isActive?: boolean;
}

export interface GLCodeUploadResult {
  created: number;
  updated: number;
  total: number;
  errors: { row: number; code?: string; message: string }[];
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&')}`;
}

export const glCodesApi = {
  list: (filters: GLCodeListFilters = {}) =>
    http.get<GLCode[]>(
      `/gl-codes${qs({
        category: filters.category,
        search: filters.search,
        active: filters.active === undefined ? undefined : String(filters.active),
      })}`,
    ),
  get: (id: string) => http.get<GLCode>(`/gl-codes/${id}`),
  create: (input: GLCodeInput) => http.post<GLCode>('/gl-codes', input),
  update: (id: string, input: Partial<GLCodeInput>) => http.patch<GLCode>(`/gl-codes/${id}`, input),
  remove: (id: string) => http.delete(`/gl-codes/${id}`),
  upload: (payload: { codes?: GLCodeInput[]; csv?: string }) =>
    http.post<GLCodeUploadResult>('/gl-codes/upload', payload),
};
