import { authed, createTestUser } from './helpers';

describe('task dependencies', () => {
  it('creates and lists dependencies in both directions', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });

    // A depends on B
    const created = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    expect(created.status).toBe(201);

    const aDeps = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(aDeps.body.dependsOn).toHaveLength(1);
    expect(aDeps.body.dependsOn[0].dependsOnTask.title).toBe('B');

    const bDeps = await authed(user).get(`/api/tasks/${b.body.id}/dependencies`);
    expect(bDeps.body.blocks).toHaveLength(1);
    expect(bDeps.body.blocks[0].task.title).toBe('A');
  });

  it('rejects self-dependency', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const res = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(res.status).toBe(400);
  });

  it('rejects cycles (direct and transitive)', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    const c = await authed(user).post('/api/tasks').send({ title: 'C' });

    // A → B
    await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });
    // B → C
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: c.body.id });
    // C → A would close A → B → C → A
    const cycle = await authed(user)
      .post(`/api/tasks/${c.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(cycle.status).toBe(409);
  });

  it('removes a dependency', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    const created = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    const del = await authed(user).delete(`/api/dependencies/${created.body.id}`);
    expect(del.status).toBe(204);

    const after = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(after.body.dependsOn).toHaveLength(0);
  });
});
