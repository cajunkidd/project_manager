import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/middleware/auth';
import { usersService } from '../src/modules/users/users.service';

export const app = createApp();

export interface TestUser {
  id: string;
  email: string;
  role: string;
  token: string;
}

export async function createTestUser(opts: {
  email?: string;
  displayName?: string;
  role?: string;
  password?: string;
} = {}): Promise<TestUser> {
  const user = await usersService.create({
    email: opts.email ?? `user-${Math.random().toString(36).slice(2, 10)}@example.com`,
    displayName: opts.displayName ?? 'Test User',
    password: opts.password ?? 'password1234',
    role: opts.role ?? 'user',
  });
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { id: user.id, email: user.email, role: user.role, token };
}

export function authed(user: TestUser) {
  const r = request(app);
  return {
    get: (url: string) => r.get(url).set('Authorization', `Bearer ${user.token}`),
    post: (url: string) => r.post(url).set('Authorization', `Bearer ${user.token}`),
    patch: (url: string) => r.patch(url).set('Authorization', `Bearer ${user.token}`),
    delete: (url: string) => r.delete(url).set('Authorization', `Bearer ${user.token}`),
  };
}
