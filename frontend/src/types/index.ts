export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  department?: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; displayName: string; email: string };
  createdBy?: { id: string; displayName: string };
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  assignee?: { id: string; displayName: string; email: string };
  createdBy?: { id: string; displayName: string };
  parentTask?: { id: string; title: string };
  _count?: { subtasks: number; comments: number };
  subtasks?: Task[];
  comments?: Comment[];
  activityLogs?: ActivityLog[];
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string };
}

export interface ActivityLog {
  id: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  createdAt: string;
  user?: { id: string; displayName: string };
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}
