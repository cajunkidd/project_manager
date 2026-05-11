import request from 'supertest';
import { app, authed, createTestUser } from './helpers';
import { buildMessageCard } from '../src/modules/integrations/teams.dispatcher';
import { prisma } from '../src/db/prisma';
import { outlookService } from '../src/modules/integrations/outlook.service';
import { apiTokensService } from '../src/modules/api-tokens/api-tokens.service';

describe('Integrations — external systems CRUD', () => {
  it('admin can register a Teams system and list/update/delete it', async () => {
    const admin = await createTestUser({ role: 'admin' });

    const created = await authed(admin)
      .post('/api/integrations/systems')
      .send({
        name: 'IT Team channel',
        kind: 'teams',
        config: { webhookUrl: 'https://teams.example/webhook/abc' },
        events: ['task.assigned'],
      });
    expect(created.status).toBe(201);
    const id: string = created.body.id;

    const listed = await authed(admin).get('/api/integrations/systems');
    expect(listed.body.find((s: { id: string }) => s.id === id)).toBeDefined();

    const patched = await authed(admin)
      .patch(`/api/integrations/systems/${id}`)
      .send({ isActive: false });
    expect(patched.body.isActive).toBe(false);

    const removed = await authed(admin).delete(`/api/integrations/systems/${id}`);
    expect(removed.status).toBe(204);
  });

  it('non-admin cannot create or delete systems', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/integrations/systems')
      .send({ name: 'x', kind: 'teams', config: {} });
    expect(res.status).toBe(403);
  });
});

describe('Integrations — external links', () => {
  it('creates a link with the configured URL template applied', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const project = await authed(admin).post('/api/projects').send({ name: 'ERP linked' });
    const task = await authed(admin)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Acme work order' });

    const sys = await authed(admin)
      .post('/api/integrations/systems')
      .send({
        name: 'Acme ERP',
        kind: 'erp',
        config: { linkTemplate: 'https://erp.example.com/wo/{id}' },
      });

    const link = await authed(admin).post('/api/integrations/links').send({
      systemId: sys.body.id,
      entityType: 'task',
      entityId: task.body.id,
      externalId: 'WO-42',
    });
    expect(link.status).toBe(201);
    expect(link.body.url).toBe('https://erp.example.com/wo/WO-42');
    expect(link.body.label).toBe('Acme ERP');

    const list = await authed(admin).get(`/api/integrations/links/task/${task.body.id}`);
    expect(list.body).toHaveLength(1);
  });
});

describe('Integrations — Teams MessageCard', () => {
  it('builds a card with the task title and a color for status changes', () => {
    const card = buildMessageCard({
      type: 'task.status_changed',
      task: {
        id: 't1',
        title: 'Ship the new dashboard',
        status: 'done',
        priority: 'high',
        // remaining fields don't matter for the formatter
      } as never,
      fromStatus: 'in_progress',
      toStatus: 'done',
    });
    expect(card['@type']).toBe('MessageCard');
    expect(card.title).toBe('Ship the new dashboard');
    expect(card.themeColor).toBe('16a34a');
    expect(card.sections?.[0].facts).toEqual(
      expect.arrayContaining([
        { name: 'From', value: 'in_progress' },
        { name: 'To', value: 'done' },
      ]),
    );
  });
});

describe('Integrations — Monday import', () => {
  it('imports boards + items, normalizes status/priority, links assignees by email', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const existing = await createTestUser({ email: 'alice@example.com' });

    const res = await authed(admin)
      .post('/api/integrations/monday/import')
      .send({
        boards: [
          {
            id: '1',
            name: 'Network refresh',
            description: 'Imported from monday',
            items: [
              {
                id: '10',
                name: 'Replace switch in Lake Charles',
                column_values: [
                  { id: 'status', type: 'status', text: 'Working on it' },
                  { id: 'priority', title: 'Priority', text: 'Critical' },
                  { id: 'date', type: 'date', value: '{"date":"2026-05-15"}' },
                  {
                    id: 'people',
                    type: 'people',
                    value: '{"personsAndTeams":[{"email":"alice@example.com"}]}',
                  },
                ],
              },
              {
                id: '11',
                name: 'Document new VLAN',
                column_values: [
                  { id: 'status', type: 'status', text: 'Done' },
                  { id: 'priority', title: 'Priority', text: 'Low' },
                ],
              },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.projectsCreated).toBe(1);
    expect(res.body.tasksCreated).toBe(2);
    expect(res.body.usersMatched).toBeGreaterThanOrEqual(1);

    const project = await prisma.project.findUnique({ where: { id: res.body.projectIds[0] } });
    expect(project?.name).toBe('Network refresh');
    const tasks = await prisma.task.findMany({ where: { projectId: project!.id } });
    const switchTask = tasks.find((t) => t.title.startsWith('Replace switch'))!;
    expect(switchTask.status).toBe('in_progress');
    expect(switchTask.priority).toBe('urgent');
    expect(switchTask.assignedToId).toBe(existing.id);
    expect(switchTask.dueDate?.toISOString().startsWith('2026-05-15')).toBe(true);
    const doneTask = tasks.find((t) => t.title === 'Document new VLAN')!;
    expect(doneTask.status).toBe('done');
    expect(doneTask.priority).toBe('low');
  });

  it('records a failed import job for bad payloads', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await authed(admin).post('/api/integrations/monday/import').send({});
    expect(res.status).toBe(400);
  });
});

describe('Integrations — Outlook calendar feed', () => {
  it('serves a signed iCalendar feed with the user’s due tasks', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Calendar' });
    const due = new Date(Date.now() + 86_400_000).toISOString();
    await authed(user).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'Patch the firewall',
      assignedToId: user.id,
      dueDate: due,
    });

    const urlRes = await authed(user).get('/api/integrations/outlook/me/calendar-url');
    expect(urlRes.status).toBe(200);
    expect(urlRes.body.url).toContain(`/outlook/calendar/${user.id}.ics?token=`);

    const path = new URL(urlRes.body.url, 'http://localhost').pathname;
    const search = new URL(urlRes.body.url, 'http://localhost').search;
    const feed = await request(app).get(`${path}${search}`);
    expect(feed.status).toBe(200);
    expect(feed.headers['content-type']).toContain('text/calendar');
    expect(feed.text).toContain('BEGIN:VCALENDAR');
    expect(feed.text).toContain('SUMMARY:Patch the firewall');
  });

  it('rejects a tampered calendar token', async () => {
    const user = await createTestUser();
    const real = outlookService.tokenFor(user.id);
    const tampered = real.slice(0, -2) + 'aa';
    const res = await request(app).get(
      `/api/integrations/outlook/calendar/${user.id}.ics?token=${tampered}`,
    );
    expect(res.status).toBe(401);
  });
});

describe('Integrations — intranet portal intake', () => {
  it('creates a task and an external link from an API-token-authenticated request', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const { token } = await apiTokensService.create(
      { name: 'Intranet portal', scopes: ['tasks:write'] },
      admin.id,
    );

    const res = await request(app)
      .post('/api/integrations/intake')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'New monitor needed',
        description: 'For the front desk',
        priority: 'high',
        externalId: 'PRT-15',
        externalUrl: 'https://intranet.example.com/requests/15',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New monitor needed');

    const links = await prisma.externalLink.findMany({
      where: { entityType: 'task', entityId: res.body.id },
    });
    expect(links).toHaveLength(1);
    expect(links[0].externalId).toBe('PRT-15');
    expect(links[0].url).toBe('https://intranet.example.com/requests/15');
  });

  it('rejects intake calls without a valid API token', async () => {
    const res = await request(app)
      .post('/api/integrations/intake')
      .send({ title: 'x' });
    expect(res.status).toBe(401);
  });
});
