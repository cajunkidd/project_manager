import type { User } from '../types';
import { http } from './client';

export type UserRole = User['role'];

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  department?: string | null;
  isActive?: boolean;
}

export const usersApi = {
  list: () => http.get<User[]>('/users'),
  update: (id: string, input: UpdateUserInput) => http.patch<User>(`/users/${id}`, input),
  deactivate: (id: string) => http.delete<User>(`/users/${id}`),
};
