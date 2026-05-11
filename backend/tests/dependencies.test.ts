import { authed, createTestUser } from './helpers';

describe('task dependencies', () => {
  it('blocks status progression while a blocker is open', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'spec' });
    const b = await authed(user).post('/api/tasks').send({ title: 'build' });

    const dep = await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ blockerTaskId: a.body.id });
    expect(dep.status).toBe(201);

    const blocked = await authed(user)
      .patch(`/api/tasks/${b.body.id}/status`)
      .send({ status: 'in_progress' });
    expect(blocked.status).toBe(409);

    await authed(user).patch(`/api/tasks/${a.body.id}/status`).send({ status: 'done' });

    const unblocked = await authed(user)
      .patch(`/api/tasks/${b.body.id}/status`)
      .send({ status: 'in_progress' });
    expect(unblocked.status).toBe(200);
  });

  it('rejects cycles', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    const c = await authed(user).post('/api/tasks').send({ title: 'C' });
    // A blocks B, B blocks C, attempting C blocks A should fail.
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ blockerTaskId: a.body.id });
    await authed(user)
      .post(`/api/tasks/${c.body.id}/dependencies`)
      .send({ blockerTaskId: b.body.id });
    const cycle = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ blockerTaskId: c.body.id });
    expect(cycle.status).toBe(409);
  });

  it('removes a dependency', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ blockerTaskId: a.body.id });
    const del = await authed(user).delete(`/api/tasks/${b.body.id}/dependencies/${a.body.id}`);
    expect(del.status).toBe(204);
  });
});
