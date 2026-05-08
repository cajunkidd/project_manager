import { authed, createTestUser } from './helpers';

describe('intake forms', () => {
  it('admin can create a form with fields', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });

    const res = await authed(admin)
      .post('/api/forms')
      .send({
        name: 'IT Request',
        description: 'Submit IT issues here',
        defaultPriority: 'high',
        fields: [
          { label: 'Summary', fieldType: 'text', isRequired: true },
          { label: 'Details', fieldType: 'textarea' },
          {
            label: 'Category',
            fieldType: 'dropdown',
            options: ['Network', 'Hardware', 'Software'],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.fields).toHaveLength(3);
    expect(res.body.defaultPriority).toBe('high');
  });

  it('non-admin/manager cannot create a form', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/forms')
      .send({ name: 'X', fields: [] });
    expect(res.status).toBe(403);
  });

  it('submitting a form creates a task linked back to the submission', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
    const submitter = await createTestUser({ email: 'user@x.com' });

    const project = await authed(manager).post('/api/projects').send({ name: 'IT queue' });

    const form = await authed(manager)
      .post('/api/forms')
      .send({
        name: 'IT Request',
        defaultProjectId: project.body.id,
        defaultAssigneeId: manager.id,
        defaultPriority: 'high',
        fields: [
          { label: 'Summary', fieldType: 'text', isRequired: true },
          { label: 'Details', fieldType: 'textarea' },
        ],
      });

    const summaryFieldId = form.body.fields[0].id;
    const detailsFieldId = form.body.fields[1].id;

    const submitted = await authed(submitter)
      .post(`/api/forms/${form.body.id}/submit`)
      .send({
        responseData: {
          [summaryFieldId]: 'Printer offline',
          [detailsFieldId]: 'Floor 2 printer is offline',
        },
      });

    expect(submitted.status).toBe(201);
    expect(submitted.body.task.title).toBe('Printer offline');
    expect(submitted.body.task.priority).toBe('high');
    expect(submitted.body.task.projectId).toBe(project.body.id);
    expect(submitted.body.task.assignedToId).toBe(manager.id);
    expect(submitted.body.submission.createdTaskId).toBe(submitted.body.task.id);

    // assignee got a task_assigned notification
    const mgrNotifs = await authed(manager).get('/api/notifications');
    expect(mgrNotifs.body.some((n: { type: string }) => n.type === 'task_assigned')).toBe(true);
  });

  it('rejects submissions missing required fields', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const form = await authed(manager)
      .post('/api/forms')
      .send({
        name: 'F',
        fields: [{ label: 'Summary', fieldType: 'text', isRequired: true }],
      });

    const fieldId = form.body.fields[0].id;
    const res = await authed(manager)
      .post(`/api/forms/${form.body.id}/submit`)
      .send({ responseData: { [fieldId]: '' } });
    expect(res.status).toBe(400);
  });

  it('users can list their own submissions', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const submitter = await createTestUser({ email: 'sub@x.com' });
    const form = await authed(manager)
      .post('/api/forms')
      .send({
        name: 'F',
        fields: [{ label: 'Summary', fieldType: 'text' }],
      });

    const fieldId = form.body.fields[0].id;
    await authed(submitter)
      .post(`/api/forms/${form.body.id}/submit`)
      .send({ responseData: { [fieldId]: 'My request' } });

    const mine = await authed(submitter).get('/api/forms/submissions?mine=true');
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].submittedBy.id).toBe(submitter.id);
  });
});
