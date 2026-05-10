import { http } from './client';

export interface ProjectSummary {
  status: string;
  headline: string;
  completed: string[];
  open: string[];
  overdue: string[];
  blockers: string[];
  recommendations: string[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
  };
}

export interface RiskScore {
  score: number;
  level: 'low' | 'moderate' | 'elevated' | 'high';
  explanation: string;
  factors: { label: string; impact: number; detail: string }[];
}

export interface ExtractedTask {
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'backlog' | 'to_do' | 'in_progress' | 'waiting' | 'review' | 'done' | 'cancelled';
  dueDate: string | null;
  reason?: string;
}

export interface ExecutiveProjectRow {
  projectId: string;
  name: string;
  status: string;
  department: string | null;
  ownerName: string | null;
  dueDate: string | null;
  daysToDue: number | null;
  risk: RiskScore;
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  completedTasks: number;
  loggedSeconds: number;
  taskCompletionsThisWeek: number;
  recentlyUpdatedAt: string;
}

export interface ExecutiveSummary {
  generatedAt: string;
  windowDays: number;
  headline: string;
  totals: {
    activeProjects: number;
    openTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    completedThisWeek: number;
    loggedHoursThisWeek: number;
  };
  attention: ExecutiveProjectRow[];
  movers: ExecutiveProjectRow[];
  stalled: ExecutiveProjectRow[];
  byDepartment: { department: string; activeProjects: number; openTasks: number; overdueTasks: number }[];
}

export const aiApi = {
  summarizeProject: (id: string) => http.get<ProjectSummary>(`/projects/${id}/ai/summary`),
  scoreProjectRisk: (id: string) => http.get<RiskScore>(`/projects/${id}/ai/risk`),
  extractTasks: (text: string) =>
    http.post<{ tasks: ExtractedTask[] }>('/ai/extract-tasks', { text }),
  executiveSummary: (opts: { windowDays?: number; department?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.windowDays) params.set('windowDays', String(opts.windowDays));
    if (opts.department) params.set('department', opts.department);
    const qs = params.toString();
    return http.get<ExecutiveSummary>(`/ai/executive-summary${qs ? `?${qs}` : ''}`);
  },
};
