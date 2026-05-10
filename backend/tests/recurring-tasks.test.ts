import { authed, createTestUser } from './helpers';

describe('recurring tasks', () => {
  it('creates a daily recurring task rule', async () => {
    const user = await createTestUser();
    const startAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const res = await authed(user).post('/api/recurring-tasks').send({
      name: 'Daily standup capture',
      title: 'Capture standup notes',
      frequency: 'daily',
      interval: 1,
      startAt,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Daily standup capture',
      frequency: 'daily',
      interval: 1,
      isActive: true,
    });
    expect(new Date(res.body.nextRunAt).toISOString()).toBe(startAt);
  });

  it('rejects unsupported frequency', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/recurring-tasks').send({
      name: 'bad',
      title: 'x',
      frequency: 'yearly',
      startAt: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it('runs due rules, generates tasks, and advances nextRunAt', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr-r@x.com' });
    const target = await createTestUser({ email: 'tgt-r@x.com' });
    const past = new Date(Date.now() - 60 * 60_000).toISOString();

    const rule = await authed(manager).post('/api/recurring-tasks').send({
      name: 'Weekly status report',
      title: 'Weekly status report',
      assignedToId: target.id,
      frequency: 'weekly',
      interval: 1,
      dueOffsetDays: 2,
      startAt: past,
    });
    expect(rule.status).toBe(201);

    const run = await authed(manager).post('/api/recurring-tasks/run-due').send({});
    expect(run.status).toBe(200);
    expect(run.body.generated).toBe(1);
    expect(run.body.taskIds).toHaveLength(1);

    const task = await authed(manager).get(`/api/tasks/${run.body.taskIds[0]}`);
    expect(task.body.title).toBe('Weekly status report');
    expect(task.body.assignedToId).toBe(target.id);
    expect(task.body.dueDate).not.toBeNull();

    const updated = await authed(manager).get(`/api/recurring-tasks/${rule.body.id}`);
    expect(updated.body.lastRunAt).not.toBeNull();
    // 1 week after the original past nextRunAt
    const expectedNext = new Date(past).getTime() + 7 * 86400_000;
    expect(new Date(updated.body.nextRunAt).getTime()).toBeGreaterThanOrEqual(expectedNext);
  });

  it('does not generate tasks for future-dated rules', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr-future@x.com' });
    const future = new Date(Date.now() + 7 * 86400_000).toISOString();
    await authed(manager).post('/api/recurring-tasks').send({
      name: 'Later',
      title: 'Later',
      frequency: 'daily',
      startAt: future,
    });
    const run = await authed(manager).post('/api/recurring-tasks/run-due').send({});
    expect(run.body.generated).toBe(0);
  });

  it('non-manager cannot trigger run-due', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/recurring-tasks/run-due').send({});
    expect(res.status).toBe(403);
  });

  it('deactivates a rule once its endAt passes', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr-end@x.com' });
    const past = new Date(Date.now() - 2 * 86400_000).toISOString();
    const endAt = new Date(Date.now() - 86400_000).toISOString();
    const rule = await authed(manager).post('/api/recurring-tasks').send({
      name: 'Ended rule',
      title: 'Already over',
      frequency: 'daily',
      startAt: past,
      endAt,
    });
    await authed(manager).post('/api/recurring-tasks/run-due').send({});
    const after = await authed(manager).get(`/api/recurring-tasks/${rule.body.id}`);
    expect(after.body.isActive).toBe(false);
  });

  it('lists and deletes a rule', async () => {
    const user = await createTestUser();
    const create = await authed(user).post('/api/recurring-tasks').send({
      name: 'L',
      title: 'L',
      frequency: 'daily',
      startAt: new Date().toISOString(),
    });
    const list = await authed(user).get('/api/recurring-tasks');
    expect(list.body.find((r: { id: string }) => r.id === create.body.id)).toBeTruthy();
    const del = await authed(user).delete(`/api/recurring-tasks/${create.body.id}`);
    expect(del.status).toBe(204);
    const after = await authed(user).get(`/api/recurring-tasks/${create.body.id}`);
    expect(after.status).toBe(404);
  });
});
