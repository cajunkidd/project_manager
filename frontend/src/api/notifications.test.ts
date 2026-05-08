import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from './client';
import { notificationsApi } from './notifications';

describe('notificationsApi', () => {
  beforeEach(() => {
    setToken('tok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setToken(null);
  });

  it('lists notifications', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await notificationsApi.list();
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/notifications$/);
  });

  it('queries unread-only when requested', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await notificationsApi.list({ unreadOnly: true });
    expect(fetchMock.mock.calls[0]![0]).toMatch(/unreadOnly=true$/);
  });

  it('hits the unread-count endpoint', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ count: 3 }), { status: 200 }));
    const res = await notificationsApi.unreadCount();
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/notifications\/unread-count$/);
    expect(res.count).toBe(3);
  });

  it('sends PATCH to mark-all-read', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ updated: 0 }), { status: 200 }));
    await notificationsApi.markAllRead();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/read-all$/);
  });
});
