import { getToken } from './client';

export interface AttachmentRecord {
  id: string;
  taskId: string | null;
  projectId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: { id: string; displayName: string; email: string } | null;
}

const API_BASE =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api';

async function fetchJson<T>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export const attachmentsApi = {
  listForTask: (taskId: string) =>
    fetchJson<AttachmentRecord[]>(`${API_BASE}/tasks/${taskId}/attachments`),
  uploadToTask: (taskId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetchJson<AttachmentRecord>(`${API_BASE}/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: form,
    });
  },
  remove: (id: string) =>
    fetchJson<void>(`${API_BASE}/attachments/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: string) => `${API_BASE}/attachments/${id}/download`,
};
