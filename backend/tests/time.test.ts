import { authed, createTestUser } from './helpers';

describe('time tracking', () => {
  it('logs time and rolls up by user and task', async () => {
    const alice = await createTestUser({ email: 'alice@t.com' });
    const bob = await createTestUser({ email: 'bob@t.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Site' });
    await authed(alice)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: bob.id });
    const task = await authed(alice)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Install' });

    await authed(alice).post(`/api/tasks/${task.body.id}/time`).send({ minutes: 60 });
    await authed(bob).post(`/api/tasks/${task.body.id}/time`).send({ minutes: 90, notes: 'pulled cable' });

    const rollup = await authed(alice).get(`/api/tasks/${task.body.id}/time/rollup`);
    expect(rollup.body.totalMinutes).toBe(150);
    expect(rollup.body.byUser).toHaveLength(2);

    const projectRollup = await authed(alice).get(`/api/projects/${project.body.id}/time/rollup`);
    expect(projectRollup.body.totalMinutes).toBe(150);
    expect(projectRollup.body.byTask).toHaveLength(1);

    const mine = await authed(alice).get('/api/time/me');
    expect(mine.body).toHaveLength(1);
  });

  it('refuses zero or negative minutes', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 'x' });
    const bad = await authed(user)
      .post(`/api/tasks/${task.body.id}/time`)
      .send({ minutes: 0 });
    expect(bad.status).toBe(400);
  });
});
