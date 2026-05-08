import { prisma } from '../src/db/prisma';
import { authed, createTestUser } from './helpers';

describe('reports routes', () => {
  it('regular users cannot access reports', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/reports/tasks-by-user');
    expect(res.status).toBe(403);
  });

  it('returns open task counts grouped by user', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const a = await createTestUser({ email: 'a@x.com', displayName: 'Alpha' });
    const b = await createTestUser({ email: 'b@x.com', displayName: 'Beta' });

    await authed(manager).post('/api/tasks').send({ title: 'a1', assignedToId: a.id });
    await authed(manager).post('/api/tasks').send({ title: 'a2', assignedToId: a.id });
    await authed(manager).post('/api/tasks').send({ title: 'b1', assignedToId: b.id });
    // closed task should not count
    const done = await authed(manager).post('/api/tasks').send({ title: 'done', assignedToId: a.id });
    await authed(manager).patch(`/api/tasks/${done.body.id}/status`).send({ status: 'done' });

    const res = await authed(manager).get('/api/reports/tasks-by-user');
    expect(res.status).toBe(200);
    const counts = new Map(
      res.body.map((row: { user: { id: string }; count: number }) => [row.user.id, row.count]),
    );
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBe(1);
  });

  it('returns overdue tasks', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    const tomorrow = new Date(Date.now() + 86400_000).toISOString();
    await authed(manager).post('/api/tasks').send({ title: 'late', dueDate: yesterday });
    await authed(manager).post('/api/tasks').send({ title: 'soon', dueDate: tomorrow });

    const res = await authed(manager).get('/api/reports/overdue');
    expect(res.status).toBe(200);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(['late']);
  });

  it('summarizes projects by status', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    await authed(manager).post('/api/projects').send({ name: 'a', status: 'active' });
    await authed(manager).post('/api/projects').send({ name: 'b', status: 'active' });
    await authed(manager).post('/api/projects').send({ name: 'c', status: 'on_hold' });

    const res = await authed(manager).get('/api/reports/projects-by-status');
    const map = Object.fromEntries(
      res.body.map((r: { status: string; count: number }) => [r.status, r.count]),
    );
    expect(map.active).toBe(2);
    expect(map.on_hold).toBe(1);
  });

  it('counts tasks completed by week', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const t1 = await authed(manager).post('/api/tasks').send({ title: 'x' });
    await authed(manager).patch(`/api/tasks/${t1.body.id}/status`).send({ status: 'done' });
    const t2 = await authed(manager).post('/api/tasks').send({ title: 'y' });
    await authed(manager).patch(`/api/tasks/${t2.body.id}/status`).send({ status: 'done' });

    const res = await authed(manager).get('/api/reports/completion-by-week');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const total = res.body.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0,
    );
    expect(total).toBe(2);
  });

  it('reports average completion time on done tasks', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const created = await authed(manager).post('/api/tasks').send({ title: 'fast' });
    // Backdate createdAt so completion math has signal.
    await prisma.task.update({
      where: { id: created.body.id },
      data: { createdAt: new Date(Date.now() - 4 * 3600_000) },
    });
    await authed(manager).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'done' });

    const res = await authed(manager).get('/api/reports/avg-completion');
    expect(res.body.sampleSize).toBe(1);
    expect(res.body.avgHours).toBeGreaterThan(0);
  });

  it('lists waiting/blocked tasks', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const waiting = await authed(manager).post('/api/tasks').send({ title: 'stuck' });
    await authed(manager)
      .patch(`/api/tasks/${waiting.body.id}/status`)
      .send({ status: 'waiting' });
    await authed(manager).post('/api/tasks').send({ title: 'normal' });

    const res = await authed(manager).get('/api/reports/blocked');
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(['stuck']);
  });
});
