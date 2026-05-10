import { authed, createTestUser } from './helpers';

describe('project templates', () => {
  it('hides templates from the default project list', async () => {
    const user = await createTestUser();
    await authed(user).post('/api/projects').send({ name: 'Real project' });
    await authed(user)
      .post('/api/projects')
      .send({ name: 'Template A', isTemplate: true });

    const def = await authed(user).get('/api/projects');
    expect(def.body).toHaveLength(1);
    expect(def.body[0].name).toBe('Real project');

    const templates = await authed(user).get('/api/projects?isTemplate=true');
    expect(templates.body).toHaveLength(1);
    expect(templates.body[0].name).toBe('Template A');
    expect(templates.body[0].isTemplate).toBe(true);
  });

  it('clones a project copying tasks but resetting status and clearing dates', async () => {
    const user = await createTestUser();
    const tpl = await authed(user)
      .post('/api/projects')
      .send({ name: 'Onboarding template', isTemplate: true });
    const tplId = tpl.body.id;

    const t1 = await authed(user).post('/api/tasks').send({
      projectId: tplId,
      title: 'Send laptop',
      priority: 'high',
      status: 'done',
      dueDate: new Date('2026-05-12T00:00:00Z').toISOString(),
    });
    const t2 = await authed(user)
      .post('/api/tasks')
      .send({ projectId: tplId, title: 'Schedule kickoff' });
    await authed(user).post('/api/tasks').send({
      projectId: tplId,
      title: 'Order monitor',
      parentTaskId: t1.body.id,
    });

    const cloned = await authed(user)
      .post(`/api/projects/${tplId}/clone`)
      .send({ name: 'Alice onboarding' });
    expect(cloned.status).toBe(201);
    expect(cloned.body.name).toBe('Alice onboarding');
    expect(cloned.body.isTemplate).toBe(false);
    expect(cloned.body.status).toBe('not_started');

    const newTasks = await authed(user).get(`/api/projects/${cloned.body.id}/tasks`);
    expect(newTasks.body).toHaveLength(3);
    for (const t of newTasks.body) {
      expect(t.status).toBe('to_do');
      expect(t.completedAt).toBeNull();
      expect(t.dueDate).toBeNull();
    }
    const titles = newTasks.body.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(['Order monitor', 'Schedule kickoff', 'Send laptop']);

    // Subtask parent pointers were remapped to the cloned tasks, not the source.
    const sourceIds = new Set([t1.body.id, t2.body.id]);
    for (const t of newTasks.body) {
      if (t.parentTaskId) {
        expect(sourceIds.has(t.parentTaskId)).toBe(false);
      }
    }
    const cloneOfParent = newTasks.body.find(
      (t: { title: string }) => t.title === 'Send laptop',
    );
    const cloneOfChild = newTasks.body.find(
      (t: { title: string }) => t.title === 'Order monitor',
    );
    expect(cloneOfChild.parentTaskId).toBe(cloneOfParent.id);
  });

  it('uses a default name when none is supplied to clone', async () => {
    const user = await createTestUser();
    const tpl = await authed(user)
      .post('/api/projects')
      .send({ name: 'Quarterly review', isTemplate: true });
    const cloned = await authed(user).post(`/api/projects/${tpl.body.id}/clone`).send({});
    expect(cloned.status).toBe(201);
    expect(cloned.body.name).toBe('Quarterly review (copy)');
  });

  it('returns 404 cloning an unknown project', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/projects/00000000-0000-0000-0000-000000000000/clone')
      .send({});
    expect(res.status).toBe(404);
  });

  it('records activity log entry on clone', async () => {
    const user = await createTestUser();
    const tpl = await authed(user)
      .post('/api/projects')
      .send({ name: 'Source', isTemplate: true });
    const cloned = await authed(user).post(`/api/projects/${tpl.body.id}/clone`).send({});
    const activity = await authed(user).get(`/api/projects/${cloned.body.id}/activity`);
    expect(
      activity.body.some((a: { action: string }) => a.action === 'cloned'),
    ).toBe(true);
  });
});
