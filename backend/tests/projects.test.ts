import { authed, createTestUser } from './helpers';

describe('projects routes', () => {
  it('creates a project with sensible defaults', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/projects')
      .send({ name: 'Network refresh', department: 'IT' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Network refresh',
      status: 'not_started',
      priority: 'normal',
    });
  });

  it('lists, filters, and searches projects', async () => {
    const user = await createTestUser();
    await authed(user)
      .post('/api/projects')
      .send({ name: 'Active project', status: 'active' });
    await authed(user)
      .post('/api/projects')
      .send({ name: 'On hold project', status: 'on_hold' });

    const all = await authed(user).get('/api/projects');
    expect(all.body).toHaveLength(2);

    const active = await authed(user).get('/api/projects?status=active');
    expect(active.body).toHaveLength(1);
    expect(active.body[0].status).toBe('active');

    const search = await authed(user).get('/api/projects?search=hold');
    expect(search.body).toHaveLength(1);
    expect(search.body[0].name).toBe('On hold project');
  });

  it('updates a project and stamps completedAt when moving to completed', async () => {
    const user = await createTestUser();
    const created = await authed(user).post('/api/projects').send({ name: 'P' });
    const id = created.body.id;

    const completed = await authed(user)
      .patch(`/api/projects/${id}`)
      .send({ status: 'completed' });
    expect(completed.status).toBe(200);
    expect(completed.body.completedAt).not.toBeNull();

    const reopened = await authed(user)
      .patch(`/api/projects/${id}`)
      .send({ status: 'active' });
    expect(reopened.body.completedAt).toBeNull();
  });

  it('records activity log entries on create and update', async () => {
    const user = await createTestUser();
    const created = await authed(user).post('/api/projects').send({ name: 'Logged' });
    await authed(user).patch(`/api/projects/${created.body.id}`).send({ priority: 'high' });

    const activity = await authed(user).get(`/api/projects/${created.body.id}/activity`);
    expect(activity.body.length).toBeGreaterThanOrEqual(2);
    expect(activity.body.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['created', 'updated']),
    );
  });

  it('returns 404 for unknown project', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/projects/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('validates create input', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/projects').send({});
    expect(res.status).toBe(400);
  });

  it('deletes a project', async () => {
    const user = await createTestUser();
    const created = await authed(user).post('/api/projects').send({ name: 'Doomed' });
    const del = await authed(user).delete(`/api/projects/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await authed(user).get(`/api/projects/${created.body.id}`);
    expect(after.status).toBe(404);
  });
});
