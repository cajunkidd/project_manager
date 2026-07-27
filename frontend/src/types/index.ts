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

export interface GLCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { contracts: number; invoices: number };
}

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface GLCodeRef {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  vendor: string | null;
  amount: number | null;
  status: ContractStatus;
  startDate: string | null;
  endDate: string | null;
  glCodeId: string | null;
  createdAt: string;
  updatedAt: string;
  glCode?: GLCodeRef | null;
  invoices?: { id: string; invoiceNumber: string; amount: number; status: string }[];
  _count?: { invoices: number };
}

export type InvoiceStatus = 'pending' | 'approved' | 'paid' | 'void';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string | null;
  amount: number;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  glCodeId: string | null;
  contractId: string | null;
  createdAt: string;
  updatedAt: string;
  glCode?: GLCodeRef | null;
  contract?: { id: string; contractNumber: string; title: string } | null;
}
