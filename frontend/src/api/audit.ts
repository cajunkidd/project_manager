import { ApiError, getToken, http } from './client';

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  createdAt: string;
  user?: { id: string; displayName: string; email: string } | null;
}

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}

function qs(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.limit) params.set('limit', String(filters.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const auditApi = {
  list: (filters: AuditFilters = {}) => http.get<AuditEntry[]>(`/audit${qs(filters)}`),
  downloadCsv: async (filters: AuditFilters = {}): Promise<void> => {
    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/audit/export.csv${qs(filters)}`, { headers });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
