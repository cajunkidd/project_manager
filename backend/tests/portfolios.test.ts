import { authed, createTestUser } from './helpers';

describe('portfolios', () => {
  it('creates a portfolio with initial projects', async () => {
    const user = await createTestUser({ email: 'pf-a@x.com' });
    const p1 = await authed(user).post('/api/projects').send({ name: 'Alpha' });
    const p2 = await authed(user).post('/api/projects').send({ name: 'Beta' });

    const portfolio = await authed(user).post('/api/portfolios').send({
      name: 'Customer initiatives',
      description: 'Q2 customer-facing work',
      projectIds: [p1.body.id, p2.body.id],
    });
    expect(portfolio.status).toBe(201);
    expect(portfolio.body.projects).toHaveLength(2);
    expect(portfolio.body.projects[0].project.name).toBe('Alpha');
  });

  it('adds and removes projects from a portfolio (no duplicates)', async () => {
    const user = await createTestUser({ email: 'pf-b@x.com' });
    const portfolio = await authed(user).post('/api/portfolios').send({ name: 'Roster' });
    const project = await authed(user).post('/api/projects').send({ name: 'P' });

    const add = await authed(user)
      .post(`/api/portfolios/${portfolio.body.id}/projects`)
      .send({ projectId: project.body.id });
    expect(add.status).toBe(201);

    const dup = await authed(user)
      .post(`/api/portfolios/${portfolio.body.id}/projects`)
      .send({ projectId: project.body.id });
    expect(dup.status).toBe(409);

    const remove = await authed(user).delete(
      `/api/portfolios/${portfolio.body.id}/projects/${project.body.id}`,
    );
    expect(remove.status).toBe(204);

    const after = await authed(user).get(`/api/portfolios/${portfolio.body.id}`);
    expect(after.body.projects).toHaveLength(0);
  });

  it('returns summary rollup across portfolio projects', async () => {
    const user = await createTestUser({ email: 'pf-c@x.com' });
    const p1 = await authed(user).post('/api/projects').send({ name: 'Active', status: 'active' });
    const p2 = await authed(user).post('/api/projects').send({ name: 'Hold', status: 'on_hold' });
    const portfolio = await authed(user).post('/api/portfolios').send({
      name: 'Rollup',
      projectIds: [p1.body.id, p2.body.id],
    });

    const t1 = await authed(user)
      .post('/api/tasks')
      .send({ title: 'a', projectId: p1.body.id });
    await authed(user)
      .post('/api/tasks')
      .send({ title: 'b', projectId: p1.body.id });
    const overdue = await authed(user).post('/api/tasks').send({
      title: 'overdue',
      projectId: p2.body.id,
      dueDate: new Date(Date.now() - 86400_000).toISOString(),
    });
    await authed(user).patch(`/api/tasks/${t1.body.id}/status`).send({ status: 'done' });
    await authed(user)
      .post(`/api/tasks/${overdue.body.id}/time-entries`)
      .send({ minutes: 45 });

    const summary = await authed(user).get(`/api/portfolios/${portfolio.body.id}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.projectCount).toBe(2);
    expect(summary.body.projectsByStatus.active).toBe(1);
    expect(summary.body.projectsByStatus.on_hold).toBe(1);
    expect(summary.body.taskCount).toBe(3);
    expect(summary.body.completedTasks).toBe(1);
    expect(summary.body.overdueTasks).toBe(1);
    expect(summary.body.minutesLogged).toBe(45);
    expect(summary.body.completionPct).toBeCloseTo(33.3, 1);
  });

  it('summary returns zeros for an empty portfolio', async () => {
    const user = await createTestUser({ email: 'pf-empty@x.com' });
    const portfolio = await authed(user).post('/api/portfolios').send({ name: 'Empty' });
    const summary = await authed(user).get(`/api/portfolios/${portfolio.body.id}/summary`);
    expect(summary.body.projectCount).toBe(0);
    expect(summary.body.taskCount).toBe(0);
    expect(summary.body.completionPct).toBe(0);
  });

  it('cascades portfolio_project links when the project is deleted', async () => {
    const user = await createTestUser({ email: 'pf-cascade@x.com' });
    const project = await authed(user).post('/api/projects').send({ name: 'Doomed' });
    const portfolio = await authed(user).post('/api/portfolios').send({
      name: 'Cascade',
      projectIds: [project.body.id],
    });
    await authed(user).delete(`/api/projects/${project.body.id}`);
    const after = await authed(user).get(`/api/portfolios/${portfolio.body.id}`);
    expect(after.body.projects).toHaveLength(0);
  });
});
