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
