import { authed, createTestUser } from './helpers';

describe('project templates', () => {
  it('saves a project as a template and instantiates a copy', async () => {
    const user = await createTestUser();
    const project = await authed(user)
      .post('/api/projects')
      .send({ name: 'Onboarding', priority: 'high' });
    await authed(user).post('/api/tasks').send({ projectId: project.body.id, title: 'Order laptop' });
    const parent = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Provision accounts' });
    await authed(user)
      .post('/api/tasks')
      .send({ title: 'Email setup', parentTaskId: parent.body.id, projectId: project.body.id });

    const template = await authed(user)
      .post('/api/templates/from-project')
      .send({ projectId: project.body.id, name: 'Onboarding template' });
    expect(template.status).toBe(201);

    const instance = await authed(user)
      .post(`/api/templates/${template.body.id}/instantiate`)
      .send({ name: 'Onboard Alice' });
    expect(instance.status).toBe(201);
    expect(instance.body.name).toBe('Onboard Alice');

    const tasks = await authed(user).get(`/api/projects/${instance.body.id}/tasks`);
    const titles = tasks.body.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(['Order laptop', 'Provision accounts']));

    // Subtask preserved
    const provision = tasks.body.find((t: { title: string }) => t.title === 'Provision accounts');
    const provDetail = await authed(user).get(`/api/tasks/${provision.id}`);
    expect(provDetail.body.subtasks).toHaveLength(1);
    expect(provDetail.body.subtasks[0].title).toBe('Email setup');
  });
});
