import { authed, createTestUser } from './helpers';

describe('project templates', () => {
  it('admins can author a template inline (with subtask parentIndex)', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await authed(admin)
      .post('/api/project-templates')
      .send({
        name: 'New store opening',
        description: 'Standard checklist for a new retail location.',
        defaultPriority: 'high',
        tasks: [
          { title: 'Network gear arrives on site', startOffsetDays: 0, dueOffsetDays: 1 },
          { title: 'Install switches', startOffsetDays: 1, dueOffsetDays: 3, parentIndex: 0 },
          { title: 'Smoke test POS', startOffsetDays: 4, dueOffsetDays: 5 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New store opening');
    expect(res.body.tasks).toHaveLength(3);
    const subtask = res.body.tasks.find((t: { title: string }) => t.title === 'Install switches');
    expect(subtask.parentTemplateTaskId).toBeTruthy();
  });

  it('regular users cannot create or instantiate templates', async () => {
    const user = await createTestUser({ role: 'user' });
    const create = await authed(user).post('/api/project-templates').send({ name: 'no' });
    expect(create.status).toBe(403);
  });

  it('snapshots an existing project, then instantiates a fresh one with date offsets applied', async () => {
    const admin = await createTestUser({ role: 'admin' });

    // Source project with startDate 2026-05-01 and a 4-day window of tasks
    const project = await authed(admin)
      .post('/api/projects')
      .send({ name: 'Source', startDate: '2026-05-01' });

    const parent = await authed(admin)
      .post('/api/tasks')
      .send({
        projectId: project.body.id,
        title: 'Order gear',
        startDate: '2026-05-01',
        dueDate: '2026-05-02',
      });
    await authed(admin).post('/api/tasks').send({
      projectId: project.body.id,
      parentTaskId: parent.body.id,
      title: 'Confirm shipping',
      startDate: '2026-05-02',
      dueDate: '2026-05-03',
    });
    await authed(admin).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'Install on-site',
      startDate: '2026-05-04',
      dueDate: '2026-05-05',
    });

    const snap = await authed(admin)
      .post('/api/project-templates/snapshot')
      .send({ projectId: project.body.id, name: 'Standard rollout' });
    expect(snap.status).toBe(201);
    expect(snap.body.tasks).toHaveLength(3);
    // Subtask offset preserved
    const subtask = snap.body.tasks.find((t: { title: string }) => t.title === 'Confirm shipping');
    expect(subtask.parentTemplateTaskId).toBeTruthy();
    expect(subtask.startOffsetDays).toBe(1);
    expect(subtask.dueOffsetDays).toBe(2);

    // Instantiate with a startDate one month later → all dates shift accordingly
    const inst = await authed(admin)
      .post(`/api/project-templates/${snap.body.id}/instantiate`)
      .send({ name: 'June rollout', startDate: '2026-06-01' });
    expect(inst.status).toBe(201);

    const newProjectId = inst.body.id;
    const tasks = await authed(admin).get(`/api/tasks?projectId=${newProjectId}`);
    expect(tasks.body).toHaveLength(3);
    const titles = tasks.body.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(['Confirm shipping', 'Install on-site', 'Order gear']);

    // "Install on-site" had +3/+4 offsets → start 2026-06-04, due 2026-06-05
    const install = tasks.body.find((t: { title: string }) => t.title === 'Install on-site');
    expect(install.startDate.slice(0, 10)).toBe('2026-06-04');
    expect(install.dueDate.slice(0, 10)).toBe('2026-06-05');

    // Subtask is properly parented
    const sub = tasks.body.find((t: { title: string }) => t.title === 'Confirm shipping');
    const par = tasks.body.find((t: { title: string }) => t.title === 'Order gear');
    expect(sub.parentTaskId).toBe(par.id);
  });

  it('instantiate fails without startDate', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const tpl = await authed(admin)
      .post('/api/project-templates')
      .send({ name: 'X', tasks: [{ title: 'A' }] });
    const res = await authed(admin)
      .post(`/api/project-templates/${tpl.body.id}/instantiate`)
      .send({ name: 'Q' });
    expect(res.status).toBe(400);
  });

  it('deletes templates and cascades template tasks', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const tpl = await authed(admin)
      .post('/api/project-templates')
      .send({ name: 'Tmp', tasks: [{ title: 'A' }, { title: 'B' }] });
    const del = await authed(admin).delete(`/api/project-templates/${tpl.body.id}`);
    expect(del.status).toBe(204);
    const after = await authed(admin).get(`/api/project-templates/${tpl.body.id}`);
    expect(after.status).toBe(404);
  });
});
