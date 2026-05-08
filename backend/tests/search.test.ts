import { authed, createTestUser } from './helpers';

describe('global search', () => {
  it('matches across tasks, projects, and comments', async () => {
    const user = await createTestUser();

    const project = await authed(user)
      .post('/api/projects')
      .send({ name: 'Network refresh', description: 'Lake Charles core' });
    const task = await authed(user)
      .post('/api/tasks')
      .send({
        projectId: project.body.id,
        title: 'Replace switch in Lake Charles',
        description: 'Vendor is on-site',
      });
    await authed(user)
      .post(`/api/tasks/${task.body.id}/comments`)
      .send({ body: 'Confirmed Lake Charles arrival window' });

    const res = await authed(user).get('/api/search?q=lake+charles');
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
    expect(res.body.comments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.tasks[0].title).toContain('Lake Charles');
    expect(res.body.tasks[0].url).toBe(`/tasks/${task.body.id}`);
    expect(res.body.comments[0].snippet.toLowerCase()).toContain('lake charles');
  });

  it('is case-insensitive', async () => {
    const user = await createTestUser();
    await authed(user).post('/api/projects').send({ name: 'Switch upgrade' });
    const res = await authed(user).get('/api/search?q=SWITCH');
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty result sets when nothing matches', async () => {
    const user = await createTestUser();
    await authed(user).post('/api/projects').send({ name: 'A' });
    const res = await authed(user).get('/api/search?q=zzzzzzznothing');
    expect(res.body.tasks).toEqual([]);
    expect(res.body.projects).toEqual([]);
    expect(res.body.comments).toEqual([]);
  });

  it('rejects empty queries', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/search?q=');
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const fake = { id: 'x', email: 'x', role: 'user', token: 'invalid' };
    const res = await authed(fake).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });
});
