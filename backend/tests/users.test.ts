import { authed, createTestUser } from './helpers';

describe('users routes', () => {
  it('lists users for authenticated callers', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    await createTestUser({ email: 'a@x.com' });
    await createTestUser({ email: 'b@x.com' });
    const res = await authed(admin).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0]).not.toHaveProperty('passwordHash');
  });

  it('rejects unauthenticated requests', async () => {
    const fake = { id: 'x', email: 'x', role: 'user', token: 'invalid' };
    const res = await authed(fake).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('admin can create a user', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin2@x.com' });
    const res = await authed(admin)
      .post('/api/users')
      .send({
        email: 'new@x.com',
        displayName: 'New',
        password: 'password1234',
        role: 'manager',
      });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('manager');
  });

  it('non-admin cannot create a user', async () => {
    const user = await createTestUser({ email: 'plain@x.com' });
    const res = await authed(user)
      .post('/api/users')
      .send({
        email: 'nope@x.com',
        displayName: 'Nope',
        password: 'password1234',
      });
    expect(res.status).toBe(403);
  });

  it('admin can deactivate a user', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin3@x.com' });
    const target = await createTestUser({ email: 'target@x.com' });
    const res = await authed(admin).delete(`/api/users/${target.id}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });
});
