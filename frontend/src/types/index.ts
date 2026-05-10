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

export interface Attachment {
  id: string;
  taskId: string | null;
  projectId: string | null;
  uploadedById: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: { id: string; displayName: string; email: string } | null;
}

export interface TaskDependencyRef {
  id: string;
  createdAt: string;
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: string | null;
  };
}

export interface TaskDependencies {
  dependencies: TaskDependencyRef[];
  dependents: TaskDependencyRef[];
  isBlocked: boolean;
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
