import { authed, createTestUser } from './helpers';

describe('AI — task extraction', () => {
  it('extracts tasks from a numbered list', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/ai/extract-tasks')
      .send({
        text: `1. Replace the switch in Lake Charles
2. Verify cabling
3. Update documentation
4. Notify the store manager`,
      });
    expect(res.status).toBe(200);
    const titles: string[] = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toEqual([
      'Replace the switch in Lake Charles',
      'Verify cabling',
      'Update documentation',
      'Notify the store manager',
    ]);
  });

  it('flags urgent priority from keywords', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/ai/extract-tasks')
      .send({ text: 'ASAP: patch the server\nReview logs tomorrow' });
    const tasks = res.body.tasks as { title: string; priority: string; dueDate: string | null }[];
    expect(tasks[0].priority).toBe('urgent');
    expect(tasks[1].dueDate).not.toBeNull();
  });

  it('rejects empty input', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/ai/extract-tasks').send({ text: '' });
    expect(res.status).toBe(400);
  });
});

describe('AI — project summary', () => {
  it('summarizes project status with metrics and recommendations', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Migration' });
    await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Plan rollout' });
    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    await authed(user).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'Cutover',
      dueDate: yesterday,
    });
    const blocked = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Vendor follow-up' });
    await authed(user).patch(`/api/tasks/${blocked.body.id}/status`).send({ status: 'waiting' });

    const res = await authed(user).get(`/api/projects/${project.body.id}/ai/summary`);
    expect(res.status).toBe(200);
    expect(res.body.metrics.totalTasks).toBe(3);
    expect(res.body.metrics.overdueTasks).toBe(1);
    expect(res.body.metrics.blockedTasks).toBe(1);
    expect(res.body.overdue).toContain('Cutover');
    expect(res.body.recommendations.join(' ')).toMatch(/overdue/);
  });

  it('returns 404 for unknown project', async () => {
    const user = await createTestUser();
    const res = await authed(user).get(
      '/api/projects/00000000-0000-0000-0000-000000000000/ai/summary',
    );
    expect(res.status).toBe(404);
  });
});

describe('AI — risk score', () => {
  it('returns low risk for a healthy project', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Healthy' });
    await authed(user).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'Step 1',
      assignedToId: user.id,
    });

    const res = await authed(user).get(`/api/projects/${project.body.id}/ai/risk`);
    expect(res.status).toBe(200);
    expect(res.body.score).toBeLessThan(40);
    expect(['low', 'moderate']).toContain(res.body.level);
  });

  it('returns elevated/high risk for projects with overdue and blocked work', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Sinking' });

    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    for (let i = 0; i < 3; i += 1) {
      await authed(user).post('/api/tasks').send({
        projectId: project.body.id,
        title: `Late ${i}`,
        dueDate: yesterday,
      });
    }
    const blocked = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Stuck' });
    await authed(user).patch(`/api/tasks/${blocked.body.id}/status`).send({ status: 'waiting' });

    const res = await authed(user).get(`/api/projects/${project.body.id}/ai/risk`);
    expect(res.body.score).toBeGreaterThan(30);
    expect(['elevated', 'high', 'moderate']).toContain(res.body.level);
    const factorLabels = res.body.factors.map((f: { label: string }) => f.label);
    expect(factorLabels).toContain('Overdue tasks');
  });
});
