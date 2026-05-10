import { authed, createTestUser } from './helpers';

describe('task dependencies', () => {
  it('creates a dependency and lists it from both sides', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });

    const created = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    expect(created.status).toBe(201);
    expect(created.body.task.id).toBe(b.body.id);

    const forA = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(forA.body.dependencies).toHaveLength(1);
    expect(forA.body.dependents).toHaveLength(0);
    expect(forA.body.isBlocked).toBe(true);

    const forB = await authed(user).get(`/api/tasks/${b.body.id}/dependencies`);
    expect(forB.body.dependents).toHaveLength(1);
    expect(forB.body.dependents[0].task.id).toBe(a.body.id);
  });

  it('reports isBlocked false once the upstream task is done', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    await authed(user).patch(`/api/tasks/${b.body.id}/status`).send({ status: 'done' });

    const forA = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(forA.body.isBlocked).toBe(false);
  });

  it('rejects self-dependencies', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const res = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(res.status).toBe(400);
  });

  it('rejects cycles', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    const c = await authed(user).post('/api/tasks').send({ title: 'C' });

    // A depends on B, B depends on C
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: c.body.id });

    // Adding C -> A would close the cycle A -> B -> C -> A
    const res = await authed(user)
      .post(`/api/tasks/${c.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(res.status).toBe(409);
  });

  it('rejects duplicate dependencies', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    const dup = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    expect(dup.status).toBe(409);
  });

  it('removes a dependency', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    const del = await authed(user).delete(
      `/api/tasks/${a.body.id}/dependencies/${b.body.id}`,
    );
    expect(del.status).toBe(204);

    const after = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(after.body.dependencies).toHaveLength(0);
  });
});
