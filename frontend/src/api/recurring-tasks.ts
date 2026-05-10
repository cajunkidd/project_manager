import { http } from './client';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringTask {
  id: string;
  name: string;
  projectId: string | null;
  title: string;
  description: string | null;
  priority: string;
  assignedToId: string | null;
  frequency: RecurringFrequency;
  interval: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  dueOffsetDays: number;
  nextRunAt: string;
  endAt: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string } | null;
  assignedTo?: { id: string; displayName: string; email: string } | null;
}

export interface CreateRecurringTaskInput {
  name: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: string;
  assignedToId?: string | null;
  frequency: RecurringFrequency;
  interval?: number;
  dueOffsetDays?: number;
  startAt: string;
  endAt?: string | null;
}

export const recurringTasksApi = {
  list: () => http.get<RecurringTask[]>('/recurring-tasks'),
  create: (input: CreateRecurringTaskInput) =>
    http.post<RecurringTask>('/recurring-tasks', input),
  update: (id: string, input: Partial<CreateRecurringTaskInput> & { isActive?: boolean }) =>
    http.patch<RecurringTask>(`/recurring-tasks/${id}`, input),
  remove: (id: string) => http.delete(`/recurring-tasks/${id}`),
  runDue: () =>
    http.post<{ generated: number; taskIds: string[] }>('/recurring-tasks/run-due', {}),
};
