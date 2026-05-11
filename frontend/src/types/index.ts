export type ProjectStatus =
  | 'not_started'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type TaskStatus =
  | 'backlog'
  | 'to_do'
  | 'in_progress'
  | 'waiting'
  | 'review'
  | 'done'
  | 'cancelled';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  department: string | null;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  priority: Priority;
  department: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  portfolioId: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; displayName: string; email: string } | null;
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignedToId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; displayName: string; email: string } | null;
  project?: { id: string; name: string } | null;
  subtasks?: Task[];
}

export interface Comment {
  id: string;
  body: string;
  taskId: string | null;
  projectId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string; email: string };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export type FormFieldType = 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'user';

export interface FormField {
  id: string;
  formId: string;
  label: string;
  fieldType: FormFieldType;
  isRequired: boolean;
  options: string | null;
  sortOrder: number;
}

export interface IntakeForm {
  id: string;
  name: string;
  description: string | null;
  defaultProjectId: string | null;
  defaultAssigneeId: string | null;
  defaultPriority: Priority;
  isActive: boolean;
  fields: FormField[];
  defaultProject?: { id: string; name: string } | null;
  defaultAssignee?: { id: string; displayName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  submittedById: string | null;
  responseData: string;
  createdTaskId: string | null;
  createdAt: string;
  form?: { id: string; name: string };
  submittedBy?: { id: string; displayName: string; email: string } | null;
  createdTask?: { id: string; title: string; status: string } | null;
}

export type AutomationTrigger =
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'comment_created'
  | 'form_submitted';

export type AutomationActionType =
  | 'send_notification'
  | 'assign_user'
  | 'change_status'
  | 'change_priority'
  | 'add_comment';

export interface AutomationCondition {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
}

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; displayName: string; email: string } | null;
  _count?: { projects: number };
}

export interface PortfolioRollup {
  portfolioId: string;
  total: number;
  byStatus: Record<string, number>;
  budgetTotal: number;
  overdue: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  payload: string;
  createdById: string | null;
  createdAt: string;
  createdBy?: { id: string; displayName: string; email: string } | null;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringTaskRule {
  id: string;
  name: string;
  projectId: string | null;
  templateTitle: string;
  templateDesc: string | null;
  templatePriority: Priority;
  assignedToId: string | null;
  frequency: RecurringFrequency;
  nextRunAt: string;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependencyBlocker {
  id: string;
  blockedTaskId: string;
  blockerTaskId: string;
  blockerTask: { id: string; title: string; status: TaskStatus };
}

export interface TaskDependencyBlocked {
  id: string;
  blockedTaskId: string;
  blockerTaskId: string;
  blockedTask: { id: string; title: string; status: TaskStatus };
}

export interface TaskDependencyGraph {
  blockedBy: TaskDependencyBlocker[];
  blocking: TaskDependencyBlocked[];
}

export type BudgetKind = 'planned' | 'actual';

export interface BudgetEntry {
  id: string;
  projectId: string;
  kind: BudgetKind;
  amount: number;
  description: string | null;
  occurredAt: string;
  createdBy?: { id: string; displayName: string; email: string } | null;
}

export interface BudgetRollup {
  projectId: string;
  currency: string;
  budget: number | null;
  planned: number;
  actual: number;
  remaining: number | null;
  utilization: number | null;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  minutes: number;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  user?: { id: string; displayName: string; email: string };
  task?: { id: string; title: string; projectId: string | null };
}

export interface TimeRollup {
  taskId?: string;
  projectId?: string;
  totalMinutes: number;
  byUser: Array<{ user: { id: string; displayName: string }; minutes: number }>;
  byTask?: Array<{ task: { id: string; title: string }; minutes: number }>;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalEntityType = 'task' | 'project';

export interface ApprovalRequest {
  id: string;
  entityType: ApprovalEntityType;
  entityId: string;
  status: ApprovalStatus;
  reason: string | null;
  decisionNote: string | null;
  targetStatus: string | null;
  requestedById: string;
  approverId: string | null;
  decisionAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy?: { id: string; displayName: string; email: string };
  approver?: { id: string; displayName: string; email: string } | null;
}

export type ProjectMemberRole = 'owner' | 'editor' | 'viewer';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdAt: string;
  user: { id: string; displayName: string; email: string };
}

export interface AutomationRule {
  id: string;
  name: string;
  triggerType: AutomationTrigger;
  conditions: string | null;
  actions: string;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}
