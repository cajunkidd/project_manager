import { prisma } from '../src/db/prisma';
import { authed, createTestUser } from './helpers';

describe('time tracking', () => {
  it('starts a timer, then stops it and computes durationMs', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });

    const start = await authed(user).post(`/api/tasks/${task.body.id}/time-entries/start`).send({});
    expect(start.status).toBe(201);
    expect(start.body.endedAt).toBeNull();
    expect(start.body.durationMs).toBeNull();

    // Backdate startedAt so the duration is non-trivial without sleeping.
    await prisma.timeEntry.update({
      where: { id: start.body.id },
      data: { startedAt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    const stop = await authed(user).post(`/api/time-entries/${start.body.id}/stop`);
    expect(stop.status).toBe(200);
    expect(stop.body.endedAt).not.toBeNull();
    expect(stop.body.durationMs).toBeGreaterThanOrEqual(29 * 60 * 1000);
  });

  it('only one timer can be running per user', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });

    const first = await authed(user).post(`/api/tasks/${a.body.id}/time-entries/start`).send({});
    expect(first.status).toBe(201);

    const second = await authed(user).post(`/api/tasks/${b.body.id}/time-entries/start`).send({});
    expect(second.status).toBe(409);
  });

  it('GET /time-entries/active returns the running timer', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });

    const before = await authed(user).get('/api/time-entries/active');
    expect(before.body).toBeNull();

    await authed(user).post(`/api/tasks/${task.body.id}/time-entries/start`).send({});
    const after = await authed(user).get('/api/time-entries/active');
    expect(after.body.task.id).toBe(task.body.id);
    expect(after.body.endedAt).toBeNull();
  });

  it('stop-active ends the running timer', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    await authed(user).post(`/api/tasks/${task.body.id}/time-entries/start`).send({});

    const res = await authed(user).post('/api/time-entries/stop-active').send({});
    expect(res.body.endedAt).not.toBeNull();

    const after = await authed(user).get('/api/time-entries/active');
    expect(after.body).toBeNull();
  });

  it('manual entry validates that endedAt is after startedAt', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const inverted = new Date();
    const res = await authed(user)
      .post('/api/time-entries')
      .send({
        taskId: task.body.id,
        startedAt: inverted.toISOString(),
        endedAt: new Date(inverted.getTime() - 60_000).toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it('lists entries scoped to a task', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await authed(user).post('/api/time-entries').send({
      taskId: task.body.id,
      startedAt,
      endedAt,
      note: 'investigation',
    });

    const list = await authed(user).get(`/api/tasks/${task.body.id}/time-entries`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].note).toBe('investigation');
    expect(list.body[0].durationMs).toBeGreaterThan(0);
  });

  it('manager can view weekly summary; regular users cannot', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
    const worker = await createTestUser({ email: 'w@x.com', displayName: 'Worker' });
    const task = await authed(worker).post('/api/tasks').send({ title: 't' });

    const startedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    const endedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 60 minutes
    await authed(worker).post('/api/time-entries').send({
      taskId: task.body.id,
      startedAt,
      endedAt,
    });

    const denied = await authed(worker).get('/api/time-entries/summary');
    expect(denied.status).toBe(403);

    const summary = await authed(manager).get('/api/time-entries/summary');
    expect(summary.status).toBe(200);
    const row = summary.body.find((r: { user: { id: string } }) => r.user.id === worker.id);
    expect(row).toBeDefined();
    expect(row.hours).toBeGreaterThanOrEqual(0.9);
    expect(row.hours).toBeLessThanOrEqual(1.1);
  });

  it('only the entry author (or admin) can edit / delete', async () => {
    const author = await createTestUser({ email: 'a@x.com' });
    const stranger = await createTestUser({ email: 'b@x.com' });
    const task = await authed(author).post('/api/tasks').send({ title: 't' });
    const entry = await authed(author).post('/api/time-entries').send({
      taskId: task.body.id,
      startedAt: new Date(Date.now() - 7200_000).toISOString(),
      endedAt: new Date(Date.now() - 3600_000).toISOString(),
    });

    const blocked = await authed(stranger).delete(`/api/time-entries/${entry.body.id}`);
    expect(blocked.status).toBe(403);

    const ok = await authed(author).delete(`/api/time-entries/${entry.body.id}`);
    expect(ok.status).toBe(204);
  });
});
