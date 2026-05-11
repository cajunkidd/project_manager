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

export interface DuplicateCandidate {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
}

export interface DuplicateGroup {
  similarity: number;
  tasks: DuplicateCandidate[];
}

export const aiApi = {
  summarizeProject: (id: string) => http.get<ProjectSummary>(`/projects/${id}/ai/summary`),
  scoreProjectRisk: (id: string) => http.get<RiskScore>(`/projects/${id}/ai/risk`),
  extractTasks: (text: string) =>
    http.post<{ tasks: ExtractedTask[] }>('/ai/extract-tasks', { text }),
  findDuplicates: (opts: { projectId?: string; threshold?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.projectId) params.set('projectId', opts.projectId);
    if (opts.threshold !== undefined) params.set('threshold', String(opts.threshold));
    const qs = params.toString();
    return http.get<{ groups: DuplicateGroup[] }>(`/ai/duplicates${qs ? `?${qs}` : ''}`);
  },
};
