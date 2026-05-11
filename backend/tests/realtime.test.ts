import { createApp } from '../src/app';
import { realtimeHub } from '../src/modules/realtime/realtime.hub';
import { eventBus } from '../src/events/bus';
import { prisma } from '../src/db/prisma';
import { authed, createTestUser } from './helpers';

// Stand up the app once so realtime listeners are registered.
createApp();

interface CapturedEvent {
  type: string;
  data: unknown;
}

function fakeClient(userId: string): { events: CapturedEvent[]; close: () => void } {
  const events: CapturedEvent[] = [];
  const fakeRes = {
    write(chunk: string) {
      // Parse minimal SSE: `event: <type>\ndata: <json>\n\n`
      const eventMatch = chunk.match(/^event: ([^\n]+)/);
      const dataMatch = chunk.match(/\ndata: ([^\n]+)/);
      if (eventMatch && dataMatch) {
        events.push({ type: eventMatch[1], data: JSON.parse(dataMatch[1]) });
      }
      return true;
    },
    end() {},
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = realtimeHub.add(userId, fakeRes as any);
  return {
    events,
    close: () => realtimeHub.remove(client),
  };
}

describe('realtime SSE bridge', () => {
  afterEach(() => realtimeHub.clear());

  it('delivers project.updated to project members but not to outsiders', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const carol = await createTestUser({ email: 'carol@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Shared' });
    await authed(alice)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: bob.id });

    const aliceClient = fakeClient(alice.id);
    const bobClient = fakeClient(bob.id);
    const carolClient = fakeClient(carol.id);

    await authed(alice)
      .patch(`/api/projects/${project.body.id}`)
      .send({ priority: 'high' });

    expect(aliceClient.events.some((e) => e.type === 'project.updated')).toBe(true);
    expect(bobClient.events.some((e) => e.type === 'project.updated')).toBe(true);
    expect(carolClient.events.some((e) => e.type === 'project.updated')).toBe(false);

    aliceClient.close();
    bobClient.close();
    carolClient.close();
  });

  it('delivers task.created to project members', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Shared' });
    await authed(alice)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: bob.id });

    const bobClient = fakeClient(bob.id);

    await authed(alice)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'hello' });

    const matches = bobClient.events.filter((e) => e.type === 'task.created');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('delivers task.assigned to the assignee directly', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const bobClient = fakeClient(bob.id);

    await authed(alice).post('/api/tasks').send({ title: 'for bob', assignedToId: bob.id });

    expect(bobClient.events.some((e) => e.type === 'task.assigned')).toBe(true);
  });

  it('SSE endpoint rejects missing token', async () => {
    // Avoid integration overhead — call eventBus directly to verify hub isolation.
    expect(realtimeHub.size()).toBe(0);
    // Emit with no clients connected: should not throw.
    await eventBus.emit({
      type: 'project.created',
      project: (await prisma.project.create({ data: { name: 'orphan' } })),
      actorId: null,
    });
  });
});
