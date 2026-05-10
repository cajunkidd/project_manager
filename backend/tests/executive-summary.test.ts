import { authed, createTestUser } from './helpers';

describe('executive summary', () => {
  it('returns an empty rollup when no projects exist', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await authed(admin).get('/api/ai/executive-summary');
    expect(res.status).toBe(200);
    expect(res.body.totals.activeProjects).toBe(0);
    expect(res.body.attention).toEqual([]);
  });

  it('rolls up active projects with per-project risk and totals', async () => {
    const admin = await createTestUser({ role: 'admin' });

    const p1 = await authed(admin)
      .post('/api/projects')
      .send({ name: 'Active A', status: 'active', department: 'IT' });
    const p2 = await authed(admin)
      .post('/api/projects')
      .send({ name: 'Active B', status: 'active', department: 'Ops' });
    // A completed project should NOT appear in the rollup
    await authed(admin)
      .post('/api/projects')
      .send({ name: 'Done C', status: 'completed' });

    // p1: one overdue task
    await authed(admin).post('/api/tasks').send({
      title: 'overdue thing',
      projectId: p1.body.id,
      dueDate: '2020-01-01',
      status: 'in_progress',
    });
    // p2: one open task, one completed today (counts as completedThisWeek)
    await authed(admin)
      .post('/api/tasks')
      .send({ title: 'open', projectId: p2.body.id, status: 'to_do' });
    const done = await authed(admin)
      .post('/api/tasks')
      .send({ title: 'wrapped', projectId: p2.body.id });
    await authed(admin).patch(`/api/tasks/${done.body.id}/status`).send({ status: 'done' });

    const res = await authed(admin).get('/api/ai/executive-summary');
    expect(res.status).toBe(200);
    expect(res.body.totals.activeProjects).toBe(2);
    expect(res.body.totals.openTasks).toBeGreaterThanOrEqual(2);
    expect(res.body.totals.overdueTasks).toBeGreaterThanOrEqual(1);
    expect(res.body.totals.completedThisWeek).toBeGreaterThanOrEqual(1);

    // attention list ordered by risk score desc; the project with the overdue task
    // should land at or near the top.
    expect(res.body.attention[0].name).toBe('Active A');

    // movers list contains the project with this-week completion
    const moverNames = res.body.movers.map((m: { name: string }) => m.name);
    expect(moverNames).toContain('Active B');

    // department rollup has IT and Ops
    const depts = res.body.byDepartment.map((d: { department: string }) => d.department);
    expect(depts).toEqual(expect.arrayContaining(['IT', 'Ops']));
  });

  it('regular users cannot access the executive summary', async () => {
    const user = await createTestUser({ role: 'user' });
    const res = await authed(user).get('/api/ai/executive-summary');
    expect(res.status).toBe(403);
  });

  it('honors the windowDays and department filters', async () => {
    const admin = await createTestUser({ role: 'admin' });
    await authed(admin).post('/api/projects').send({ name: 'IT one', status: 'active', department: 'IT' });
    await authed(admin).post('/api/projects').send({ name: 'Ops one', status: 'active', department: 'Ops' });

    const res = await authed(admin).get('/api/ai/executive-summary?windowDays=14&department=IT');
    expect(res.status).toBe(200);
    expect(res.body.windowDays).toBe(14);
    expect(res.body.totals.activeProjects).toBe(1);
    expect(res.body.attention[0].name).toBe('IT one');
  });
});
