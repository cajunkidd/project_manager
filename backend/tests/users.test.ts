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

  describe('master account', () => {
    it('promotes the configured master email to master on registration', async () => {
      const master = await createTestUser({
        role: 'user',
        email: 'kyle.neely@stine.biz',
      });
      // Service auto-promotes by email regardless of requested role.
      expect(master.role).toBe('master');
    });

    it('admin can change another user\'s role to manager', async () => {
      const admin = await createTestUser({ role: 'admin', email: 'admin-role@x.com' });
      const target = await createTestUser({ email: 'rolechange@x.com' });
      const res = await authed(admin)
        .patch(`/api/users/${target.id}`)
        .send({ role: 'manager' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('manager');
    });

    it('non-master admin cannot grant the master role', async () => {
      const admin = await createTestUser({ role: 'admin', email: 'admin-nomaster@x.com' });
      const target = await createTestUser({ email: 'wannabe-master@x.com' });
      const res = await authed(admin)
        .patch(`/api/users/${target.id}`)
        .send({ role: 'master' });
      expect(res.status).toBe(403);
    });

    it('master can grant the master role', async () => {
      const master = await createTestUser({
        role: 'user',
        email: 'kyle.neely@stine.biz',
      });
      expect(master.role).toBe('master');
      const target = await createTestUser({ email: 'second-master@x.com' });
      const res = await authed(master)
        .patch(`/api/users/${target.id}`)
        .send({ role: 'master' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('master');
    });

    it('non-master admin cannot modify a master account', async () => {
      const master = await createTestUser({
        role: 'user',
        email: 'kyle.neely@stine.biz',
      });
      const admin = await createTestUser({ role: 'admin', email: 'admin-vs-master@x.com' });
      const res = await authed(admin)
        .patch(`/api/users/${master.id}`)
        .send({ role: 'manager' });
      expect(res.status).toBe(403);
    });

    it('manager cannot change another user\'s role', async () => {
      const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
      const target = await createTestUser({ email: 'mgr-target@x.com' });
      const res = await authed(manager)
        .patch(`/api/users/${target.id}`)
        .send({ role: 'manager' });
      expect(res.status).toBe(403);
    });

    it('master role satisfies admin-only routes', async () => {
      const master = await createTestUser({
        role: 'user',
        email: 'kyle.neely@stine.biz',
      });
      const res = await authed(master)
        .post('/api/users')
        .send({
          email: 'made-by-master@x.com',
          displayName: 'New',
          password: 'password1234',
          role: 'manager',
        });
      expect(res.status).toBe(201);
    });
  });
});
