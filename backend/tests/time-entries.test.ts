import { authed, createTestUser } from './helpers';

describe('time entries', () => {
  it('logs time against a task and lists it', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 'work' });

    const create = await authed(user).post(`/api/tasks/${task.body.id}/time-entries`).send({
      minutes: 45,
      description: 'pair programming',
    });
    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({
      minutes: 45,
      description: 'pair programming',
      billable: true,
      userId: user.id,
      taskId: task.body.id,
    });

    const list = await authed(user).get(`/api/tasks/${task.body.id}/time-entries`);
    expect(list.body).toHaveLength(1);
  });

  it('rejects non-positive or excessive minutes', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });

    const zero = await authed(user)
      .post(`/api/tasks/${task.body.id}/time-entries`)
      .send({ minutes: 0 });
    expect(zero.status).toBe(400);

    const huge = await authed(user)
      .post(`/api/tasks/${task.body.id}/time-entries`)
      .send({ minutes: 24 * 60 + 1 });
    expect(huge.status).toBe(400);
  });

  it('prevents users from editing or deleting other users’ entries', async () => {
    const alice = await createTestUser({ email: 'alice-te@x.com' });
    const bob = await createTestUser({ email: 'bob-te@x.com' });
    const task = await authed(alice).post('/api/tasks').send({ title: 'shared' });

    const entry = await authed(alice).post(`/api/tasks/${task.body.id}/time-entries`).send({
      minutes: 30,
    });

    const editAttempt = await authed(bob)
      .patch(`/api/time-entries/${entry.body.id}`)
      .send({ minutes: 60 });
    expect(editAttempt.status).toBe(403);

    const deleteAttempt = await authed(bob).delete(`/api/time-entries/${entry.body.id}`);
    expect(deleteAttempt.status).toBe(403);
  });

  it('managers can edit other users’ entries', async () => {
    const user = await createTestUser({ email: 'user-te2@x.com' });
    const manager = await createTestUser({ role: 'manager', email: 'mgr-te@x.com' });
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const entry = await authed(user).post(`/api/tasks/${task.body.id}/time-entries`).send({
      minutes: 30,
    });

    const updated = await authed(manager)
      .patch(`/api/time-entries/${entry.body.id}`)
      .send({ minutes: 90, billable: false });
    expect(updated.status).toBe(200);
    expect(updated.body.minutes).toBe(90);
    expect(updated.body.billable).toBe(false);
  });

  it('filters by mine + projectId and aggregates by user', async () => {
    const alice = await createTestUser({ email: 'alice-sum@x.com' });
    const bob = await createTestUser({ email: 'bob-sum@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Sum' });
    const task = await authed(alice)
      .post('/api/tasks')
      .send({ title: 'task', projectId: project.body.id });

    await authed(alice).post(`/api/tasks/${task.body.id}/time-entries`).send({ minutes: 60 });
    await authed(alice).post(`/api/tasks/${task.body.id}/time-entries`).send({ minutes: 30 });
    await authed(bob).post(`/api/tasks/${task.body.id}/time-entries`).send({ minutes: 120 });

    const mine = await authed(alice).get('/api/time-entries?mine=true');
    expect(mine.body).toHaveLength(2);

    const byProject = await authed(alice).get(
      `/api/time-entries/summary?groupBy=user&projectId=${project.body.id}`,
    );
    expect(byProject.body.totals.minutes).toBe(210);
    expect(byProject.body.rows).toHaveLength(2);
    const aliceRow = byProject.body.rows.find((r: { key: string }) => r.key === alice.id);
    expect(aliceRow.minutes).toBe(90);
    const bobRow = byProject.body.rows.find((r: { key: string }) => r.key === bob.id);
    expect(bobRow.minutes).toBe(120);
  });

  it('cascades time entries when the task is deleted', async () => {
    const user = await createTestUser({ email: 'cascade-te@x.com' });
    const task = await authed(user).post('/api/tasks').send({ title: 'tmp' });
    const entry = await authed(user)
      .post(`/api/tasks/${task.body.id}/time-entries`)
      .send({ minutes: 15 });

    await authed(user).delete(`/api/tasks/${task.body.id}`);

    const del = await authed(user).delete(`/api/time-entries/${entry.body.id}`);
    expect(del.status).toBe(404);
  });
});
