import { http } from './client';

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  task?: { id: string; title: string };
  user?: { id: string; displayName: string; email: string };
}

export interface WeeklySummaryRow {
  user: { id: string; displayName: string; email: string };
  hours: number;
}

export const timeTrackingApi = {
  start: (taskId: string, note?: string | null) =>
    http.post<TimeEntry>(`/tasks/${taskId}/time-entries/start`, { note }),
  stop: (id: string) => http.post<TimeEntry>(`/time-entries/${id}/stop`, {}),
  stopActive: () => http.post<TimeEntry | null>('/time-entries/stop-active', {}),
  active: () => http.get<TimeEntry | null>('/time-entries/active'),
  listForTask: (taskId: string) => http.get<TimeEntry[]>(`/tasks/${taskId}/time-entries`),
  manual: (input: { taskId: string; startedAt: string; endedAt: string; note?: string | null }) =>
    http.post<TimeEntry>('/time-entries', input),
  remove: (id: string) => http.delete(`/time-entries/${id}`),
  weeklySummary: () => http.get<WeeklySummaryRow[]>('/time-entries/summary'),
};
