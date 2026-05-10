import type { AttachmentSummary } from '../types';
import { getToken, http } from './client';

const API_BASE =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api';

export const attachmentsApi = {
  listForTask: (taskId: string) =>
    http.get<AttachmentSummary[]>(`/tasks/${taskId}/attachments`),
  listForProject: (projectId: string) =>
    http.get<AttachmentSummary[]>(`/projects/${projectId}/attachments`),
  uploadToTask: (taskId: string, file: File) =>
    upload(`/tasks/${taskId}/attachments`, file),
  uploadToProject: (projectId: string, file: File) =>
    upload(`/projects/${projectId}/attachments`, file),
  remove: (id: string) => http.delete(`/attachments/${id}`),
  downloadUrl: (id: string) => `${API_BASE}/attachments/${id}/download`,
  fetchBlob: async (id: string): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/attachments/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return res.blob();
  },
};

async function upload(path: string, file: File): Promise<AttachmentSummary> {
  const data = await fileToBase64(file);
  return http.post<AttachmentSummary>(path, {
    fileName: file.name,
    mimeType: file.type || null,
    data,
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
