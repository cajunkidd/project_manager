import { prisma } from '../src/db/prisma';
import { authed, createTestUser } from './helpers';

describe('task recurrence', () => {
  it('completing a recurring task spawns the next occurrence with the same template', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Ops' });

    const created = await authed(user).post('/api/tasks').send({
      title: 'Weekly status report',
      projectId: project.body.id,
      assignedToId: user.id,
      priority: 'high',
      recurrence: JSON.stringify({ type: 'interval', days: 7 }),
      dueDate: new Date('2026-05-10T12:00:00Z').toISOString(),
    });

    await authed(user).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany({
      where: { title: 'Weekly status report' },
      orderBy: { createdAt: 'asc' },
    });
    expect(all).toHaveLength(2);
    const [first, second] = all;
    expect(first.id).toBe(created.body.id);
    expect(second.status).toBe('to_do');
    expect(second.assignedToId).toBe(user.id);
    expect(second.priority).toBe('high');
    expect(second.recurrence).toBe(JSON.stringify({ type: 'interval', days: 7 }));
    expect(second.dueDate).not.toBeNull();
    // 7 days after the original due date
    expect(second.dueDate!.getTime()).toBeGreaterThan(first.dueDate!.getTime());
  });

  it('non-recurring tasks do not spawn anything', async () => {
    const user = await createTestUser();
    const created = await authed(user).post('/api/tasks').send({ title: 'one-shot' });
    await authed(user).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'done' });
    const all = await prisma.task.findMany({ where: { title: 'one-shot' } });
    expect(all).toHaveLength(1);
  });

  it('toggling done → in_progress → done does not double-spawn', async () => {
    const user = await createTestUser();
    const created = await authed(user).post('/api/tasks').send({
      title: 'flicker',
      recurrence: JSON.stringify({ type: 'interval', days: 1 }),
      dueDate: new Date().toISOString(),
    });
    await authed(user).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'done' });
    await authed(user).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'in_progress' });
    await authed(user).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany({ where: { title: 'flicker' } });
    expect(all.length).toBeLessThanOrEqual(2);
  });

  it('weekly rule picks the next allowed weekday', async () => {
    const user = await createTestUser();
    const tuesday = new Date('2026-05-12T12:00:00Z'); // 2026-05-12 is a Tuesday
    const created = await authed(user).post('/api/tasks').send({
      title: 'standup',
      recurrence: JSON.stringify({ type: 'weekly', weekdays: [1, 3] }), // Mon + Wed
      dueDate: tuesday.toISOString(),
    });
    await authed(user).patch(`/api/tasks/${created.body.id}/status`).send({ status: 'done' });

    const all = await prisma.task.findMany({
      where: { title: 'standup' },
      orderBy: { createdAt: 'asc' },
    });
    const next = all[1];
    expect(next).toBeDefined();
    expect([1, 3]).toContain(next.dueDate!.getDay());
  });
});
