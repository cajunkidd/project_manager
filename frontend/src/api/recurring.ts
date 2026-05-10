import type { RecurringTaskTemplate } from '../types';
import { http } from './client';

export interface CreateRecurringInput {
  name: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  cadence: 'daily' | 'weekly' | 'monthly';
  intervalCount?: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hourOfDay?: number;
  dueOffsetDays?: number;
}

export const recurringApi = {
  list: () => http.get<RecurringTaskTemplate[]>('/recurring-tasks'),
  create: (input: CreateRecurringInput) =>
    http.post<RecurringTaskTemplate>('/recurring-tasks', input),
  update: (id: string, input: Partial<CreateRecurringInput> & { isActive?: boolean }) =>
    http.patch<RecurringTaskTemplate>(`/recurring-tasks/${id}`, input),
  remove: (id: string) => http.delete(`/recurring-tasks/${id}`),
  runDue: () =>
    http.post<{ ranTemplates: number; createdTaskIds: string[] }>('/recurring-tasks/run-due', {}),
};
