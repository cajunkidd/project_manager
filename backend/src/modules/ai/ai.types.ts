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
  attention: ExecutiveProjectRow[]; // sorted by risk desc, top N
  movers: ExecutiveProjectRow[];     // most completed this week
  stalled: ExecutiveProjectRow[];    // active projects with no recent activity
  byDepartment: { department: string; activeProjects: number; openTasks: number; overdueTasks: number }[];
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
