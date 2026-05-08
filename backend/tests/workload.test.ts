import { authed, createTestUser } from './helpers';

describe('workload', () => {
  it('regular users cannot access', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/workload');
    expect(res.status).toBe(403);
  });

  it('returns per-user counts including overdue and urgent', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const target = await createTestUser({ email: 'target@x.com', displayName: 'Target' });

    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    const tomorrow = new Date(Date.now() + 86400_000).toISOString();

    await authed(manager).post('/api/tasks').send({
      title: 'overdue',
      assignedToId: target.id,
      dueDate: yesterday,
    });
    await authed(manager).post('/api/tasks').send({
      title: 'urgent due soon',
      assignedToId: target.id,
      dueDate: tomorrow,
      priority: 'urgent',
    });
    const done = await authed(manager).post('/api/tasks').send({
      title: 'done',
      assignedToId: target.id,
    });
    await authed(manager).patch(`/api/tasks/${done.body.id}/status`).send({ status: 'done' });

    const res = await authed(manager).get('/api/workload');
    const row = res.body.find(
      (r: { user: { id: string } }) => r.user.id === target.id,
    );
    expect(row).toBeDefined();
    expect(row.open).toBe(2);
    expect(row.overdue).toBe(1);
    expect(row.urgent).toBe(1);
    expect(row.dueThisWeek).toBeGreaterThanOrEqual(1);
    expect(row.completedThisWeek).toBe(1);
  });

  it('filters by department', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const adminApi = authed(manager);

    // create users via admin endpoint — only admin role can do this; promote first
    const adminUser = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    await authed(adminUser).post('/api/users').send({
      email: 'it1@x.com',
      displayName: 'IT 1',
      password: 'password1234',
      role: 'user',
      department: 'IT',
    });
    await authed(adminUser).post('/api/users').send({
      email: 'ops1@x.com',
      displayName: 'Ops 1',
      password: 'password1234',
      role: 'user',
      department: 'Ops',
    });

    const all = await adminApi.get('/api/workload');
    const onlyIt = await adminApi.get('/api/workload?department=IT');
    expect(all.body.length).toBeGreaterThan(onlyIt.body.length);
    expect(onlyIt.body.every((r: { user: { department: string } }) => r.user.department === 'IT'))
      .toBe(true);
  });
});
