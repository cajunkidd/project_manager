import { prisma } from '../src/db/prisma';
import { authed, createTestUser } from './helpers';

describe('automations', () => {
  it('admin can create a rule and disable it', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const created = await authed(admin)
      .post('/api/automations')
      .send({
        name: 'Notify owner on done',
        triggerType: 'task_status_changed',
        actions: [
          {
            type: 'send_notification',
            params: { userId: admin.id, title: 'Heads up', message: 'A task moved to done' },
          },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.isActive).toBe(true);

    const disabled = await authed(admin)
      .patch(`/api/automations/${created.body.id}`)
      .send({ isActive: false });
    expect(disabled.body.isActive).toBe(false);
  });

  it('rejects rules without any actions', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const res = await authed(admin)
      .post('/api/automations')
      .send({ name: 'X', triggerType: 'task_created', actions: [] });
    expect(res.status).toBe(400);
  });

  it('regular users cannot list automations', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/automations');
    expect(res.status).toBe(403);
  });

  it('runs send_notification action when trigger fires and conditions match', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const target = await createTestUser({ email: 'target@x.com' });

    await authed(admin)
      .post('/api/automations')
      .send({
        name: 'Urgent task ping',
        triggerType: 'task_created',
        conditions: [{ field: 'priority', equals: 'urgent' }],
        actions: [
          {
            type: 'send_notification',
            params: {
              userId: target.id,
              title: 'Urgent task created',
              message: 'Pay attention',
            },
          },
        ],
      });

    // Non-urgent: no automation notification
    await authed(admin).post('/api/tasks').send({ title: 'normal' });
    let notifs = await prisma.notification.findMany({ where: { userId: target.id } });
    expect(notifs).toHaveLength(0);

    // Urgent: automation should fire
    await authed(admin).post('/api/tasks').send({ title: 'urgent thing', priority: 'urgent' });
    notifs = await prisma.notification.findMany({ where: { userId: target.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('automation');
    expect(notifs[0].title).toBe('Urgent task created');
  });

  it('inactive rules do not fire', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const target = await createTestUser({ email: 't@x.com' });

    const rule = await authed(admin)
      .post('/api/automations')
      .send({
        name: 'X',
        triggerType: 'task_created',
        actions: [
          {
            type: 'send_notification',
            params: { userId: target.id, title: 'a', message: 'b' },
          },
        ],
      });
    await authed(admin).patch(`/api/automations/${rule.body.id}`).send({ isActive: false });

    await authed(admin).post('/api/tasks').send({ title: 't' });
    const notifs = await prisma.notification.findMany({ where: { userId: target.id } });
    expect(notifs).toHaveLength(0);
  });
});
