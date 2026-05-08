import type { User } from '../types';
import { http } from './client';

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthResponse>('/auth/login', { email, password }),
  register: (input: { email: string; password: string; displayName: string }) =>
    http.post<AuthResponse>('/auth/register', input),
  me: () => http.get<User>('/auth/me'),
};
