import type { Attachment } from '../types';
import { ApiError, getToken, http } from './client';

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

export const attachmentsApi = {
  listForTask: (taskId: string) => http.get<Attachment[]>(`/tasks/${taskId}/attachments`),
  listForProject: (projectId: string) =>
    http.get<Attachment[]>(`/projects/${projectId}/attachments`),
  uploadToTask: async (taskId: string, file: File): Promise<Attachment> => {
    const content = await fileToBase64(file);
    return http.post<Attachment>(`/tasks/${taskId}/attachments`, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      content,
    });
  },
  uploadToProject: async (projectId: string, file: File): Promise<Attachment> => {
    const content = await fileToBase64(file);
    return http.post<Attachment>(`/projects/${projectId}/attachments`, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      content,
    });
  },
  remove: (id: string) => http.delete(`/attachments/${id}`),
  download: async (id: string, fileName: string): Promise<void> => {
    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/attachments/${id}/download`, { headers });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
