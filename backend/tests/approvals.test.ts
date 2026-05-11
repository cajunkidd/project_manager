import { authed, createTestUser } from './helpers';

describe('approval workflows', () => {
  it('requests approval, manager approves, target status is applied', async () => {
    const user = await createTestUser();
    const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
    const project = await authed(user).post('/api/projects').send({ name: 'P' });
    const task = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Risky change', status: 'review' });

    const req = await authed(user).post('/api/approvals').send({
      entityType: 'task',
      entityId: task.body.id,
      reason: 'Production deploy',
      targetStatus: 'done',
    });
    expect(req.status).toBe(201);
    expect(req.body.status).toBe('pending');

    const decided = await authed(manager).post(`/api/approvals/${req.body.id}/approve`).send({});
    expect(decided.body.status).toBe('approved');

    const after = await authed(user).get(`/api/tasks/${task.body.id}`);
    expect(after.body.status).toBe('done');
  });

  it('regular users cannot approve', async () => {
    const author = await createTestUser({ email: 'a@x.com' });
    const other = await createTestUser({ email: 'b@x.com' });
    const task = await authed(author).post('/api/tasks').send({ title: 'x' });
    const req = await authed(author).post('/api/approvals').send({
      entityType: 'task',
      entityId: task.body.id,
    });
    const denied = await authed(other).post(`/api/approvals/${req.body.id}/approve`).send({});
    expect(denied.status).toBe(400);
  });

  it('cannot have two pending requests on the same entity', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const first = await authed(user).post('/api/approvals').send({
      entityType: 'task',
      entityId: task.body.id,
    });
    expect(first.status).toBe(201);
    const dup = await authed(user).post('/api/approvals').send({
      entityType: 'task',
      entityId: task.body.id,
    });
    expect(dup.status).toBe(409);
  });

  it('requester can cancel a pending request', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const req = await authed(user).post('/api/approvals').send({
      entityType: 'task',
      entityId: task.body.id,
    });
    const cancel = await authed(user).post(`/api/approvals/${req.body.id}/cancel`).send({});
    expect(cancel.body.status).toBe('cancelled');
  });
});
