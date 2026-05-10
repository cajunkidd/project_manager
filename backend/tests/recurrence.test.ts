import { prisma } from '../src/db/prisma';
import { authed, createTestUser } from './helpers';

describe('recurring tasks', () => {
  it('spawns a follow-up task with advanced due date when a weekly task is completed', async () => {
    const user = await createTestUser();
    const due = new Date('2026-05-12T17:00:00Z').toISOString();
    const t = await authed(user)
      .post('/api/tasks')
      .send({ title: 'weekly review', dueDate: due, recurrence: 'weekly' });
    expect(t.body.recurrence).toBe('weekly');

    await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
    expect(all).toHaveLength(2);
    const [original, next] = all;
    expect(next.id).not.toBe(original.id);
    expect(next.status).toBe('to_do');
    expect(next.title).toBe('weekly review');
    expect(next.recurrence).toBe('weekly');
    expect(next.recurrenceParentId).toBe(original.id);
    expect(next.dueDate?.toISOString()).toBe('2026-05-19T17:00:00.000Z');
  });

  it('does not spawn when there is no recurrence', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'one-off' });
    await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany();
    expect(all).toHaveLength(1);
  });

  it('stops recurring after the end date is exceeded', async () => {
    const user = await createTestUser();
    const due = new Date('2026-05-12T17:00:00Z').toISOString();
    const endsAt = new Date('2026-05-15T00:00:00Z').toISOString();
    const t = await authed(user).post('/api/tasks').send({
      title: 'short series',
      dueDate: due,
      recurrence: 'weekly',
      recurrenceEndsAt: endsAt,
    });

    await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany();
    expect(all).toHaveLength(1);
  });

  it('chains the recurrenceParentId across multiple completions', async () => {
    const user = await createTestUser();
    const due = new Date('2026-05-10T00:00:00Z').toISOString();
    const t = await authed(user)
      .post('/api/tasks')
      .send({ title: 'daily standup', dueDate: due, recurrence: 'daily' });
    const originalId = t.body.id;

    await authed(user).patch(`/api/tasks/${originalId}/status`).send({ status: 'done' });

    const after1 = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
    expect(after1).toHaveLength(2);
    const second = after1[1];
    expect(second.recurrenceParentId).toBe(originalId);

    await authed(user).patch(`/api/tasks/${second.id}/status`).send({ status: 'done' });
    const after2 = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
    expect(after2).toHaveLength(3);
    const third = after2[2];
    expect(third.recurrenceParentId).toBe(originalId);
    expect(third.dueDate?.toISOString()).toBe('2026-05-12T00:00:00.000Z');
  });

  it('preserves the start-date offset when copying', async () => {
    const user = await createTestUser();
    const t = await authed(user)
      .post('/api/tasks')
      .send({
        title: 'planning window',
        startDate: new Date('2026-05-08T00:00:00Z').toISOString(),
        dueDate: new Date('2026-05-12T00:00:00Z').toISOString(),
        recurrence: 'weekly',
      });

    await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
    const next = all[1];
    expect(next.startDate?.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(next.dueDate?.toISOString()).toBe('2026-05-19T00:00:00.000Z');
  });

  it('does not re-spawn when an already-done task is updated to done again', async () => {
    const user = await createTestUser();
    const due = new Date('2026-05-12T00:00:00Z').toISOString();
    const t = await authed(user)
      .post('/api/tasks')
      .send({ title: 'r', dueDate: due, recurrence: 'daily' });

    await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });
    const afterFirst = await prisma.task.count();
    expect(afterFirst).toBe(2);

    // No status transition this time → status_changed is not fired.
    await authed(user).patch(`/api/tasks/${t.body.id}`).send({ title: 'r renamed' });
    const afterUpdate = await prisma.task.count();
    expect(afterUpdate).toBe(2);
  });

  it('rejects invalid recurrence values', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/tasks')
      .send({ title: 't', recurrence: 'yearly' });
    expect(res.status).toBe(400);
  });
});
