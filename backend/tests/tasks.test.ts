import { authed, createTestUser } from './helpers';

describe('tasks routes', () => {
  it('creates a task scoped to a project', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'P' });
    const task = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'First task' });
    expect(task.status).toBe(201);
    expect(task.body).toMatchObject({
      title: 'First task',
      status: 'to_do',
      priority: 'normal',
      projectId: project.body.id,
    });
  });

  it('supports subtasks via parentTaskId', async () => {
    const user = await createTestUser();
    const parent = await authed(user).post('/api/tasks').send({ title: 'parent' });
    const child = await authed(user)
      .post('/api/tasks')
      .send({ title: 'child', parentTaskId: parent.body.id });
    expect(child.body.parentTaskId).toBe(parent.body.id);

    const detail = await authed(user).get(`/api/tasks/${parent.body.id}`);
    expect(detail.body.subtasks).toHaveLength(1);
    expect(detail.body.subtasks[0].id).toBe(child.body.id);
  });

  it('filters tasks by status and assignee', async () => {
    const user = await createTestUser();
    const other = await createTestUser({ email: 'other@x.com' });
    await authed(user).post('/api/tasks').send({ title: 'a', status: 'to_do', assignedToId: user.id });
    await authed(user).post('/api/tasks').send({ title: 'b', status: 'in_progress', assignedToId: user.id });
    await authed(user).post('/api/tasks').send({ title: 'c', status: 'to_do', assignedToId: other.id });

    const inProgress = await authed(user).get('/api/tasks?status=in_progress');
    expect(inProgress.body).toHaveLength(1);

    const mine = await authed(user).get(`/api/tasks?assignedToId=${user.id}`);
    expect(mine.body).toHaveLength(2);
  });

  it('updateStatus stamps completedAt when moving to done', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'x' });
    const done = await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });
    expect(done.body.status).toBe('done');
    expect(done.body.completedAt).not.toBeNull();

    const reopened = await authed(user)
      .patch(`/api/tasks/${t.body.id}/status`)
      .send({ status: 'in_progress' });
    expect(reopened.body.completedAt).toBeNull();
  });

  it('reorders tasks across columns', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });

    const res = await authed(user)
      .patch('/api/tasks/reorder')
      .send({
        items: [
          { id: a.body.id, status: 'in_progress', sortOrder: 0 },
          { id: b.body.id, status: 'in_progress', sortOrder: 1 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    const list = await authed(user).get('/api/tasks?status=in_progress');
    expect(list.body.map((t: { id: string }) => t.id)).toEqual([a.body.id, b.body.id]);
  });

  it('rejects invalid status values', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/tasks').send({ title: 't', status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('records activity on create and status change', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'tracked' });
    await authed(user).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'done' });

    const activity = await authed(user).get(`/api/tasks/${t.body.id}/activity`);
    expect(activity.body.length).toBeGreaterThanOrEqual(2);
  });

  it('cascades subtasks on parent delete', async () => {
    const user = await createTestUser();
    const parent = await authed(user).post('/api/tasks').send({ title: 'p' });
    const child = await authed(user)
      .post('/api/tasks')
      .send({ title: 'c', parentTaskId: parent.body.id });

    await authed(user).delete(`/api/tasks/${parent.body.id}`);
    const after = await authed(user).get(`/api/tasks/${child.body.id}`);
    expect(after.status).toBe(404);
  });
});
