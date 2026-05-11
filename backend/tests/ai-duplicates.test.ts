import { authed, createTestUser } from './helpers';

describe('AI duplicate task detection', () => {
  it('groups tasks with highly similar titles', async () => {
    const user = await createTestUser({ email: 'dup-a@x.com' });
    const project = await authed(user).post('/api/projects').send({ name: 'Dup project' });
    const pid = project.body.id;

    await authed(user).post('/api/tasks').send({ projectId: pid, title: 'Update onboarding documentation' });
    await authed(user).post('/api/tasks').send({ projectId: pid, title: 'Update the onboarding documentation' });
    await authed(user).post('/api/tasks').send({ projectId: pid, title: 'Plan office offsite' });

    const res = await authed(user).get(`/api/projects/${pid}/ai/duplicates`);
    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(1);
    expect(res.body.groups[0].tasks).toHaveLength(2);
    expect(res.body.groups[0].similarity).toBeGreaterThanOrEqual(0.6);
  });

  it('ignores completed/cancelled tasks', async () => {
    const user = await createTestUser({ email: 'dup-b@x.com' });
    const project = await authed(user).post('/api/projects').send({ name: 'Closed dup' });
    const pid = project.body.id;

    const a = await authed(user)
      .post('/api/tasks')
      .send({ projectId: pid, title: 'Provision laptop for new hire' });
    await authed(user)
      .post('/api/tasks')
      .send({ projectId: pid, title: 'Provision laptop for the new hire' });
    await authed(user).patch(`/api/tasks/${a.body.id}/status`).send({ status: 'done' });

    const res = await authed(user).get(`/api/projects/${pid}/ai/duplicates`);
    expect(res.body.groups).toHaveLength(0);
  });

  it('returns nothing when there are no duplicates', async () => {
    const user = await createTestUser({ email: 'dup-c@x.com' });
    const project = await authed(user).post('/api/projects').send({ name: 'Unique' });
    const pid = project.body.id;
    await authed(user).post('/api/tasks').send({ projectId: pid, title: 'Renew domain registration' });
    await authed(user).post('/api/tasks').send({ projectId: pid, title: 'Review Q2 budget forecast' });

    const res = await authed(user).get(`/api/projects/${pid}/ai/duplicates`);
    expect(res.body.groups).toHaveLength(0);
  });

  it('global /api/ai/duplicates can scan across projects with a threshold', async () => {
    const user = await createTestUser({ email: 'dup-d@x.com' });
    const p1 = await authed(user).post('/api/projects').send({ name: 'P1' });
    const p2 = await authed(user).post('/api/projects').send({ name: 'P2' });
    await authed(user).post('/api/tasks').send({ projectId: p1.body.id, title: 'Migrate database to Postgres' });
    await authed(user).post('/api/tasks').send({ projectId: p2.body.id, title: 'Migrate the database to Postgres' });

    const res = await authed(user).get('/api/ai/duplicates?threshold=0.5');
    expect(res.status).toBe(200);
    const matchingGroup = res.body.groups.find((g: { tasks: { title: string }[] }) =>
      g.tasks.some((t) => t.title.toLowerCase().includes('migrate')),
    );
    expect(matchingGroup).toBeTruthy();
    expect(matchingGroup.tasks).toHaveLength(2);
  });
});
