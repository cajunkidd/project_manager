import type { Task } from '../types';
import { http } from './client';

export interface UserDashboard {
  counts: { open: number; overdue: number; dueThisWeek: number };
  open: Task[];
  overdue: Task[];
  dueThisWeek: Task[];
  recentlyUpdated: Task[];
}

export interface ManagerDashboard {
  openByUser: { userId: string; count: number }[];
  overdueByUser: { userId: string; count: number }[];
  projectsByStatus: { status: string; count: number }[];
  completedThisWeek: number;
  blocked: Task[];
}

export const dashboardApi = {
  me: () => http.get<UserDashboard>('/dashboard/me'),
  manager: () => http.get<ManagerDashboard>('/dashboard/manager'),
};
