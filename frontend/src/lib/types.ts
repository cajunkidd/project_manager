export type Role = "admin" | "manager" | "user" | "viewer";

export type ProjectStatus =
  | "not_started"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export type TaskStatus =
  | "backlog"
  | "to_do"
  | "in_progress"
  | "waiting"
  | "review"
  | "done"
  | "cancelled";

export type Priority = "low" | "normal" | "high" | "urgent";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
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
  owner?: Pick<User, "id" | "displayName" | "email"> | null;
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignedToId: string | null;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  assignedTo?: Pick<User, "id" | "displayName" | "email"> | null;
  subtasks?: Task[];
}

export interface Comment {
  id: string;
  taskId: string | null;
  projectId: string | null;
  userId: string;
  body: string;
  createdAt: string;
  user?: Pick<User, "id" | "displayName" | "email">;
}

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "to_do",
  "in_progress",
  "waiting",
  "review",
  "done",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  to_do: "To Do",
  in_progress: "In Progress",
  waiting: "Waiting",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export type FormFieldType =
  | "text"
  | "textarea"
  | "dropdown"
  | "checkbox"
  | "date"
  | "user_picker";

export interface FormField {
  id: string;
  formId: string;
  label: string;
  fieldType: FormFieldType;
  isRequired: boolean;
  options: string[] | null;
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
  createdAt: string;
  updatedAt: string;
  fields?: FormField[];
  defaultProject?: { id: string; name: string } | null;
  defaultAssignee?: { id: string; displayName: string } | null;
  _count?: { submissions: number; fields: number };
}

export interface FormSubmission {
  id: string;
  formId: string;
  submittedById: string | null;
  responseData: Record<string, unknown>;
  createdTaskId: string | null;
  createdAt: string;
  submittedBy?: { id: string; displayName: string } | null;
  createdTask?: { id: string; title: string; status: TaskStatus } | null;
}

export type AutomationTrigger =
  | "task_created"
  | "task_status_changed"
  | "task_due_date_passed"
  | "comment_created"
  | "form_submitted";

export type AutomationActionType =
  | "send_notification"
  | "assign_user"
  | "change_status"
  | "change_priority"
  | "add_comment";

export interface AutomationAction {
  type: AutomationActionType;
  userId?: string;
  message?: string;
  status?: string;
  priority?: string;
  body?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  triggerType: AutomationTrigger;
  conditions: Record<string, unknown> | null;
  actions: AutomationAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: "Not Started",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
