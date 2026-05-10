import { authed, createTestUser } from './helpers';

describe('project templates', () => {
  it('creates a template with nested tasks', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/project-templates').send({
      name: 'New employee onboarding',
      description: 'Standard onboarding checklist',
      defaultPriority: 'high',
      tasks: [
        { title: 'Provision laptop', priority: 'high', dueOffsetDays: 1, sortOrder: 0 },
        { title: 'Create accounts', priority: 'normal', dueOffsetDays: 2, sortOrder: 1 },
        { title: 'Schedule intro meetings', dueOffsetDays: 5 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.tasks).toHaveLength(3);
    expect(res.body.tasks[0].title).toBe('Provision laptop');
    expect(res.body.tasks[0].sortOrder).toBe(0);
  });

  it('instantiates a template into a real project with the same tasks', async () => {
    const user = await createTestUser();
    const tpl = await authed(user).post('/api/project-templates').send({
      name: 'Customer rollout',
      tasks: [
        { title: 'Kickoff call', dueOffsetDays: 0 },
        { title: 'Provisioning', dueOffsetDays: 7 },
      ],
    });

    const start = new Date('2026-06-01').toISOString();
    const instance = await authed(user).post(`/api/project-templates/${tpl.body.id}/instantiate`).send({
      name: 'Acme — go-live',
      startDate: start,
    });
    expect(instance.status).toBe(201);
    expect(instance.body.taskCount).toBe(2);

    const projectId = instance.body.project.id;
    const tasks = await authed(user).get(`/api/projects/${projectId}/tasks`);
    expect(tasks.body).toHaveLength(2);
    const kickoff = tasks.body.find((t: { title: string }) => t.title === 'Kickoff call');
    expect(kickoff.dueDate).toBeNull(); // offset 0 → null due
    const prov = tasks.body.find((t: { title: string }) => t.title === 'Provisioning');
    expect(new Date(prov.dueDate).toISOString().slice(0, 10)).toBe('2026-06-08');
  });

  it('updates a template, replacing its task list', async () => {
    const user = await createTestUser();
    const tpl = await authed(user).post('/api/project-templates').send({
      name: 'V1',
      tasks: [{ title: 'old' }],
    });
    const updated = await authed(user).patch(`/api/project-templates/${tpl.body.id}`).send({
      name: 'V2',
      tasks: [
        { title: 'A', sortOrder: 0 },
        { title: 'B', sortOrder: 1 },
      ],
    });
    expect(updated.body.name).toBe('V2');
    expect(updated.body.tasks).toHaveLength(2);
    expect(updated.body.tasks.map((t: { title: string }) => t.title)).toEqual(['A', 'B']);
  });

  it('deletes a template (cascading template tasks)', async () => {
    const user = await createTestUser();
    const tpl = await authed(user).post('/api/project-templates').send({
      name: 'Trash',
      tasks: [{ title: 't1' }, { title: 't2' }],
    });
    const del = await authed(user).delete(`/api/project-templates/${tpl.body.id}`);
    expect(del.status).toBe(204);
    const after = await authed(user).get(`/api/project-templates/${tpl.body.id}`);
    expect(after.status).toBe(404);
  });

  it('keeps existing projects intact after the template is deleted', async () => {
    const user = await createTestUser();
    const tpl = await authed(user).post('/api/project-templates').send({
      name: 'Reusable',
      tasks: [{ title: 'one-off' }],
    });
    const inst = await authed(user)
      .post(`/api/project-templates/${tpl.body.id}/instantiate`)
      .send({ name: 'Project X' });
    await authed(user).delete(`/api/project-templates/${tpl.body.id}`);

    const proj = await authed(user).get(`/api/projects/${inst.body.project.id}`);
    expect(proj.status).toBe(200);
    expect(proj.body.name).toBe('Project X');
  });
});
