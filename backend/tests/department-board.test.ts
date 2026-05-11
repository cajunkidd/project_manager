import { authed, createTestUser } from './helpers';

describe('department board', () => {
  it('returns projects and task status counts for a department', async () => {
    const user = await createTestUser();
    const itProject = await authed(user)
      .post('/api/projects')
      .send({ name: 'IT a', department: 'IT' });
    await authed(user).post('/api/projects').send({ name: 'IT b', department: 'IT' });
    await authed(user).post('/api/projects').send({ name: 'HR a', department: 'HR' });
    await authed(user)
      .post('/api/tasks')
      .send({ projectId: itProject.body.id, title: 'wire', status: 'in_progress' });
    await authed(user)
      .post('/api/tasks')
      .send({ projectId: itProject.body.id, title: 'patch', status: 'to_do' });

    const res = await authed(user).get('/api/dashboard/department/IT');
    expect(res.status).toBe(200);
    expect(res.body.counts.projects).toBe(2);
    expect(res.body.counts.tasks).toBe(2);
    expect(res.body.counts.byStatus.in_progress).toBe(1);
    expect(res.body.counts.byStatus.to_do).toBe(1);
    expect(res.body.tasks.every((t: { project: { name: string } }) => t.project.name.startsWith('IT'))).toBe(true);
  });
});
