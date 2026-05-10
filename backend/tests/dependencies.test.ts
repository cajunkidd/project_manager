import { authed, createTestUser } from './helpers';

describe('task dependencies', () => {
  it('lists empty dependencies for a new task', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 't' });
    const res = await authed(user).get(`/api/tasks/${t.body.id}/dependencies`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dependencies: [], dependents: [] });
  });

  it('creates a dependency and exposes it on both sides', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });

    const res = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    expect(res.status).toBe(201);
    expect(res.body.dependsOnTaskId).toBe(b.body.id);

    const aDeps = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(aDeps.body.dependencies).toHaveLength(1);
    expect(aDeps.body.dependencies[0].dependsOnTask.id).toBe(b.body.id);

    const bDeps = await authed(user).get(`/api/tasks/${b.body.id}/dependencies`);
    expect(bDeps.body.dependents).toHaveLength(1);
    expect(bDeps.body.dependents[0].task.id).toBe(a.body.id);
  });

  it('includes dependencies on the task detail payload', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    const detail = await authed(user).get(`/api/tasks/${a.body.id}`);
    expect(detail.body.dependencies).toHaveLength(1);
    expect(detail.body.dependencies[0].dependsOnTask.title).toBe('b');
  });

  it('rejects self-dependency', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const res = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate dependencies', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    const dup = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    expect(dup.status).toBe(409);
  });

  it('rejects cycles (direct and indirect)', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    const c = await authed(user).post('/api/tasks').send({ title: 'c' });

    // a depends on b, b depends on c
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: c.body.id });

    // c depending on a would close the cycle
    const cycle = await authed(user)
      .post(`/api/tasks/${c.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(cycle.status).toBe(400);
  });

  it('blocks marking task done while a dependency is still open', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    const blocked = await authed(user)
      .patch(`/api/tasks/${a.body.id}/status`)
      .send({ status: 'done' });
    expect(blocked.status).toBe(409);

    // After the blocker is done, a can be completed
    await authed(user).patch(`/api/tasks/${b.body.id}/status`).send({ status: 'done' });
    const okRes = await authed(user)
      .patch(`/api/tasks/${a.body.id}/status`)
      .send({ status: 'done' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.status).toBe('done');
  });

  it('deletes a dependency', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    const created = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    const del = await authed(user).delete(`/api/dependencies/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(list.body.dependencies).toHaveLength(0);
  });

  it('reports blocked-by-deps for managers', async () => {
    const manager = await createTestUser({ role: 'manager' });
    const a = await authed(manager).post('/api/tasks').send({ title: 'a' });
    const b = await authed(manager).post('/api/tasks').send({ title: 'b' });
    await authed(manager)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    const res = await authed(manager).get('/api/reports/blocked-by-deps');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].task.id).toBe(a.body.id);
    expect(res.body[0].blockers[0].id).toBe(b.body.id);
  });

  it('cascades dependency rows when a task is deleted', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    await authed(user).delete(`/api/tasks/${b.body.id}`);

    const list = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(list.body.dependencies).toHaveLength(0);
  });
});
