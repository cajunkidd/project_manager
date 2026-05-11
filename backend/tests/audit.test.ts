import { authed, createTestUser } from './helpers';

describe('audit log', () => {
  it('returns activity entries for admins/managers', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr-audit@x.com' });
    const project = await authed(manager).post('/api/projects').send({ name: 'Audited' });
    await authed(manager).patch(`/api/projects/${project.body.id}`).send({ status: 'active' });

    const list = await authed(manager).get('/api/audit?entityType=project');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    expect(list.body[0]).toHaveProperty('entityType', 'project');
  });

  it('filters by entityId and action', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr-audit2@x.com' });
    const a = await authed(manager).post('/api/tasks').send({ title: 'A' });
    const b = await authed(manager).post('/api/tasks').send({ title: 'B' });
    await authed(manager).patch(`/api/tasks/${a.body.id}/status`).send({ status: 'done' });

    const forA = await authed(manager).get(`/api/audit?entityType=task&entityId=${a.body.id}`);
    expect(forA.body.every((row: { entityId: string }) => row.entityId === a.body.id)).toBe(true);

    const updates = await authed(manager).get(
      `/api/audit?entityType=task&entityId=${b.body.id}&action=updated`,
    );
    expect(updates.body).toHaveLength(0);
  });

  it('forbids non-admin/manager users', async () => {
    const user = await createTestUser({ email: 'plain-audit@x.com' });
    const res = await authed(user).get('/api/audit');
    expect(res.status).toBe(403);
  });

  it('exports CSV with header row, comma-quoting, and quote-doubling', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr-csv@x.com' });
    await authed(manager).post('/api/tasks').send({ title: 'Task with, comma' });

    const res = await authed(manager).get('/api/audit/export.csv?entityType=task');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('audit-log.csv');
    const [header, ...rows] = res.text.split('\n').filter((line) => line.length > 0);
    expect(header).toBe(
      'createdAt,entityType,entityId,action,userId,userDisplayName,userEmail,oldValue,newValue',
    );
    // Each non-header row has 9 fields. Because newValue is JSON, it contains
    // commas/quotes so it must be wrapped in quotes.
    expect(rows.length).toBeGreaterThan(0);
    const lastField = rows[0].slice(rows[0].lastIndexOf(',') + 1);
    expect(lastField.startsWith('"') && lastField.endsWith('"')).toBe(true);
    // Doubled quotes (CSV-escaping of an inner ") appear at least once.
    expect(rows[0]).toMatch(/""/);
  });
});
