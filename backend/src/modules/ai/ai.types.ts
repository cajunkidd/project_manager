import type { Priority, TaskStatus } from './ai.constants';

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
  score: number; // 0–100
  level: 'low' | 'moderate' | 'elevated' | 'high';
  explanation: string;
  factors: { label: string; impact: number; detail: string }[];
}

export interface ExtractedTask {
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  reason?: string;
}

export interface ProjectAIContext {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  };
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
    assignedToId: string | null;
  }[];
  recentComments: { body: string; createdAt: Date }[];
  lastActivityAt: Date;
  dependencies: { taskId: string; dependsOnTaskId: string }[];
}
