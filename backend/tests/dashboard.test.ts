import { authed, createTestUser } from './helpers';

describe('dashboard', () => {
  it('returns user-scoped counts and lists', async () => {
    const user = await createTestUser();
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    await authed(user).post('/api/tasks').send({
      title: 'overdue',
      assignedToId: user.id,
      dueDate: yesterday,
      status: 'to_do',
    });
    await authed(user).post('/api/tasks').send({
      title: 'this week',
      assignedToId: user.id,
      dueDate: tomorrow,
      status: 'in_progress',
    });
    await authed(user).post('/api/tasks').send({
      title: 'someone else',
      status: 'to_do',
    });

    const res = await authed(user).get('/api/dashboard/me');
    expect(res.status).toBe(200);
    expect(res.body.counts.open).toBe(2);
    expect(res.body.counts.overdue).toBe(1);
  });

  it('manager dashboard requires manager role', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/dashboard/manager');
    expect(res.status).toBe(403);
  });

  it('manager dashboard returns aggregated counts', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
    await authed(manager).post('/api/projects').send({ name: 'a', status: 'active' });
    await authed(manager).post('/api/projects').send({ name: 'b', status: 'active' });
    await authed(manager).post('/api/projects').send({ name: 'c', status: 'on_hold' });

    const res = await authed(manager).get('/api/dashboard/manager');
    expect(res.status).toBe(200);
    const active = res.body.projectsByStatus.find(
      (r: { status: string }) => r.status === 'active',
    );
    expect(active.count).toBe(2);
  });
});
