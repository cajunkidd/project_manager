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

export interface TaskDependencyEdge {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  task?: { id: string; title: string; status: TaskStatus; projectId: string | null };
  dependsOn?: { id: string; title: string; status: TaskStatus; projectId: string | null };
}

export interface TaskDependencyView {
  dependencies: TaskDependencyEdge[]; // tasks this task depends on
  dependents: TaskDependencyEdge[]; // tasks that depend on this task
}

export interface ProjectDependencyEdge {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string; email: string };
  task?: { id: string; title: string; projectId: string | null };
}

export interface ProjectTimeSummary {
  totalSeconds: number;
  byUser: { user: { id: string; displayName: string; email: string }; seconds: number }[];
  byTask: { task: { id: string; title: string }; seconds: number }[];
}

export interface ProjectTemplateTask {
  id: string;
  templateId: string;
  parentTemplateTaskId: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  startOffsetDays: number | null;
  dueOffsetDays: number | null;
  sortOrder: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  defaultPriority: Priority;
  createdAt: string;
  updatedAt: string;
  tasks?: ProjectTemplateTask[];
  createdBy?: { id: string; displayName: string; email: string } | null;
}

export type RecurringCadence = 'daily' | 'weekly' | 'monthly';

export interface RecurringTaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  projectId: string | null;
  assigneeId: string | null;
  priority: Priority;
  cadence: RecurringCadence;
  intervalCount: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hourOfDay: number;
  dueOffsetDays: number;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; displayName: string; email: string } | null;
}

export interface AttachmentSummary {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  taskId: string | null;
  projectId: string | null;
  uploadedById: string | null;
  createdAt: string;
  uploadedBy?: { id: string; displayName: string; email: string } | null;
}
