import { authed, createTestUser } from './helpers';

describe('task dependencies', () => {
  it('creates and lists dependencies in both directions', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });

    const dep = await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(dep.status).toBe(201);
    expect(dep.body.taskId).toBe(b.body.id);
    expect(dep.body.dependsOnTaskId).toBe(a.body.id);

    const fromB = await authed(user).get(`/api/tasks/${b.body.id}/dependencies`);
    expect(fromB.body.dependencies).toHaveLength(1);
    expect(fromB.body.dependents).toHaveLength(0);

    const fromA = await authed(user).get(`/api/tasks/${a.body.id}/dependencies`);
    expect(fromA.body.dependencies).toHaveLength(0);
    expect(fromA.body.dependents).toHaveLength(1);
  });

  it('rejects self-dependency', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'self' });
    const res = await authed(user)
      .post(`/api/tasks/${t.body.id}/dependencies`)
      .send({ dependsOnTaskId: t.body.id });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate dependencies', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    await authed(user).post(`/api/tasks/${b.body.id}/dependencies`).send({ dependsOnTaskId: a.body.id });
    const dup = await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    expect(dup.status).toBe(409);
  });

  it('detects cycles across multi-step chains', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    const c = await authed(user).post('/api/tasks').send({ title: 'C' });

    // B depends on A, C depends on B  (chain: C -> B -> A)
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });
    await authed(user)
      .post(`/api/tasks/${c.body.id}/dependencies`)
      .send({ dependsOnTaskId: b.body.id });

    // Trying to make A depend on C would close the loop
    const cyc = await authed(user)
      .post(`/api/tasks/${a.body.id}/dependencies`)
      .send({ dependsOnTaskId: c.body.id });
    expect(cyc.status).toBe(409);
  });

  it('removes dependencies and reflects in project listing', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'P' });
    const a = await authed(user)
      .post('/api/tasks')
      .send({ title: 'A', projectId: project.body.id });
    const b = await authed(user)
      .post('/api/tasks')
      .send({ title: 'B', projectId: project.body.id });

    const dep = await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });

    const projDeps = await authed(user).get(
      `/api/projects/${project.body.id}/dependencies`,
    );
    expect(projDeps.body).toHaveLength(1);

    const del = await authed(user).delete(`/api/dependencies/${dep.body.id}`);
    expect(del.status).toBe(204);

    const after = await authed(user).get(
      `/api/projects/${project.body.id}/dependencies`,
    );
    expect(after.body).toHaveLength(0);
  });

  it('cascades dependency rows when the underlying task is deleted', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'A' });
    const b = await authed(user).post('/api/tasks').send({ title: 'B' });
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });

    await authed(user).delete(`/api/tasks/${a.body.id}`);

    const fromB = await authed(user).get(`/api/tasks/${b.body.id}/dependencies`);
    expect(fromB.body.dependencies).toHaveLength(0);
  });

  it('surfaces a missed-dependencies risk factor on the project risk endpoint', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'P' });
    const a = await authed(user)
      .post('/api/tasks')
      .send({ title: 'A', projectId: project.body.id, status: 'in_progress' });
    const b = await authed(user)
      .post('/api/tasks')
      .send({ title: 'B', projectId: project.body.id, status: 'to_do' });
    await authed(user)
      .post(`/api/tasks/${b.body.id}/dependencies`)
      .send({ dependsOnTaskId: a.body.id });

    const risk = await authed(user).get(`/api/projects/${project.body.id}/ai/risk`);
    expect(risk.status).toBe(200);
    const labels = risk.body.factors.map((f: { label: string }) => f.label);
    expect(labels).toContain('Missed dependencies');
  });
});
