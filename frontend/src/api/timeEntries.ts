import type { ProjectTimeSummary, TimeEntry } from '../types';
import { http } from './client';

export const timeEntriesApi = {
  active: () => http.get<TimeEntry | null>('/time-entries/active'),
  start: (taskId: string, note?: string | null) =>
    http.post<TimeEntry>('/time-entries/start', { taskId, note }),
  stop: () => http.post<TimeEntry>('/time-entries/stop', {}),
  addManual: (input: {
    taskId: string;
    startedAt: string;
    endedAt: string;
    note?: string | null;
  }) => http.post<TimeEntry>('/time-entries', input),
  remove: (id: string) => http.delete(`/time-entries/${id}`),
  forTask: (taskId: string) =>
    http.get<{ entries: TimeEntry[]; totalSeconds: number }>(
      `/tasks/${taskId}/time-entries`,
    ),
  projectSummary: (projectId: string) =>
    http.get<ProjectTimeSummary>(`/projects/${projectId}/time-summary`),
};
