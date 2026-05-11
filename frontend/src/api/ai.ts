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

export interface ExecSummary {
  period: { start: string; end: string; days: number };
  headline: string;
  metrics: {
    activeProjects: number;
    completedProjects: number;
    tasksCompleted: number;
    tasksCreated: number;
    tasksOverdue: number;
    tasksBlocked: number;
    commentsPosted: number;
  };
  completedHighlights: { id: string; name: string; completedAt: string }[];
  newProjects: { id: string; name: string; createdAt: string }[];
  topRisks: {
    projectId: string;
    name: string;
    overdueTasks: number;
    blockedTasks: number;
    daysSinceUpdate: number;
  }[];
  stalledProjects: { id: string; name: string; daysSinceUpdate: number }[];
  byDepartment: { department: string; active: number; completed: number; overdue: number }[];
  recommendations: string[];
}

export interface PrioritySuggestion {
  taskId: string;
  title: string;
  currentPriority: string;
  suggestedPriority: string;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
}

export interface CleanupSuggestion {
  taskId: string;
  title: string;
  action:
    | 'archive_stale'
    | 'close_orphan'
    | 'assign_owner'
    | 'add_due_date'
    | 'split_task'
    | 'reactivate';
  reason: string;
}

export interface DuplicateGroup {
  similarity: number;
  tasks: { id: string; title: string; projectId: string | null; status: string }[];
}

export interface MeetingNotesResult {
  title: string | null;
  meetingDate: string | null;
  attendees: string[];
  agenda: string[];
  decisions: string[];
  actionItems: (ExtractedTask & { assignee: string | null })[];
  summary: string;
}

export interface EmailThreadSummary {
  subject: string | null;
  participants: string[];
  messageCount: number;
  summary: string;
  keyPoints: string[];
  actionItems: ExtractedTask[];
  questions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgent: boolean;
}

export const aiApi = {
  summarizeProject: (id: string) => http.get<ProjectSummary>(`/projects/${id}/ai/summary`),
  scoreProjectRisk: (id: string) => http.get<RiskScore>(`/projects/${id}/ai/risk`),
  extractTasks: (text: string) =>
    http.post<{ tasks: ExtractedTask[] }>('/ai/extract-tasks', { text }),
  execSummary: () => http.get<ExecSummary>('/ai/exec-summary'),
  prioritize: (projectId?: string) =>
    http.get<{ suggestions: PrioritySuggestion[] }>(
      `/ai/prioritize${projectId ? `?projectId=${projectId}` : ''}`,
    ),
  cleanup: (projectId?: string) =>
    http.get<{ suggestions: CleanupSuggestion[] }>(
      `/ai/cleanup${projectId ? `?projectId=${projectId}` : ''}`,
    ),
  duplicates: (projectId?: string, threshold = 0.6) =>
    http.get<{ threshold: number; groups: DuplicateGroup[] }>(
      `/ai/duplicates?threshold=${threshold}${projectId ? `&projectId=${projectId}` : ''}`,
    ),
  meetingNotes: (text: string) =>
    http.post<MeetingNotesResult>('/ai/meeting-notes', { text }),
  summarizeEmail: (thread: { from: string; to?: string[]; subject?: string; body: string; sentAt?: string }[]) =>
    http.post<EmailThreadSummary>('/ai/summarize-email', { thread }),
};
