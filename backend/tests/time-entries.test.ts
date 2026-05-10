import { authed, createTestUser } from './helpers';

describe('time entries', () => {
  it('starts a timer, returns it as active, then stops with a duration', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'do work' });

    const start = await authed(user)
      .post('/api/time-entries/start')
      .send({ taskId: t.body.id });
    expect(start.status).toBe(201);
    expect(start.body.endedAt).toBeNull();

    const active = await authed(user).get('/api/time-entries/active');
    expect(active.body?.id).toBe(start.body.id);

    // Tiny wait so duration becomes >=1 second
    await new Promise((r) => setTimeout(r, 1100));

    const stop = await authed(user).post('/api/time-entries/stop').send({});
    expect(stop.status).toBe(200);
    expect(stop.body.endedAt).not.toBeNull();
    expect(stop.body.durationSeconds).toBeGreaterThanOrEqual(1);

    const noActive = await authed(user).get('/api/time-entries/active');
    expect(noActive.body).toBeNull();
  });

  it('rejects starting a second timer while one is running', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });

    await authed(user).post('/api/time-entries/start').send({ taskId: a.body.id });
    const dup = await authed(user)
      .post('/api/time-entries/start')
      .send({ taskId: b.body.id });
    expect(dup.status).toBe(409);
  });

  it('records a manual entry and surfaces totals on the task', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'fixed bug' });

    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endedAt = new Date().toISOString();
    const entry = await authed(user)
      .post('/api/time-entries')
      .send({ taskId: t.body.id, startedAt, endedAt, note: 'pair debugging' });
    expect(entry.status).toBe(201);
    expect(entry.body.durationSeconds).toBeGreaterThanOrEqual(3590);

    const list = await authed(user).get(`/api/tasks/${t.body.id}/time-entries`);
    expect(list.body.entries).toHaveLength(1);
    expect(list.body.totalSeconds).toBe(entry.body.durationSeconds);
  });

  it('aggregates time across a project by user and by task', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'P' });
    const t1 = await authed(alice)
      .post('/api/tasks')
      .send({ title: 'one', projectId: project.body.id });
    const t2 = await authed(alice)
      .post('/api/tasks')
      .send({ title: 'two', projectId: project.body.id });

    const hourAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    await authed(alice).post('/api/time-entries').send({
      taskId: t1.body.id, startedAt: hourAgo(2), endedAt: hourAgo(1),
    });
    await authed(bob).post('/api/time-entries').send({
      taskId: t1.body.id, startedAt: hourAgo(3), endedAt: hourAgo(2),
    });
    await authed(alice).post('/api/time-entries').send({
      taskId: t2.body.id, startedAt: hourAgo(1), endedAt: hourAgo(0.5),
    });

    const summary = await authed(alice).get(
      `/api/projects/${project.body.id}/time-summary`,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.totalSeconds).toBeGreaterThanOrEqual(2.4 * 3600);
    expect(summary.body.byUser).toHaveLength(2);
    expect(summary.body.byTask).toHaveLength(2);
  });

  it('users cannot edit or delete other users entries (managers can)', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser({ email: 'bob2@x.com' });
    const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
    const t = await authed(alice).post('/api/tasks').send({ title: 'shared' });
    const aliceEntry = await authed(alice).post('/api/time-entries').send({
      taskId: t.body.id,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      endedAt: new Date().toISOString(),
    });

    const bobDelete = await authed(bob).delete(
      `/api/time-entries/${aliceEntry.body.id}`,
    );
    expect(bobDelete.status).toBe(400);

    const mgrDelete = await authed(manager).delete(
      `/api/time-entries/${aliceEntry.body.id}`,
    );
    expect(mgrDelete.status).toBe(204);
  });

  it('rejects manual entries where end <= start', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'bad' });
    const now = new Date().toISOString();
    const res = await authed(user).post('/api/time-entries').send({
      taskId: t.body.id,
      startedAt: now,
      endedAt: now,
    });
    expect(res.status).toBe(400);
  });
});
