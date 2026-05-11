import type { ProjectMember, ProjectMemberRole } from '../types';
import { http } from './client';

export const membersApi = {
  list: (projectId: string) =>
    http.get<ProjectMember[]>(`/projects/${projectId}/members`),
  add: (projectId: string, userId: string, role: ProjectMemberRole = 'editor') =>
    http.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role }),
  updateRole: (projectId: string, userId: string, role: ProjectMemberRole) =>
    http.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, { role }),
  remove: (projectId: string, userId: string) =>
    http.delete(`/projects/${projectId}/members/${userId}`),
};
