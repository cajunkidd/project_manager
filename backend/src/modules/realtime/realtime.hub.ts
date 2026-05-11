import type { Response } from 'express';

interface Client {
  userId: string;
  res: Response;
}

const clients = new Set<Client>();

export const realtimeHub = {
  add(userId: string, res: Response): Client {
    const client: Client = { userId, res };
    clients.add(client);
    return client;
  },

  remove(client: Client): void {
    clients.delete(client);
  },

  send(userIds: Iterable<string>, event: { type: string; data: unknown }): void {
    const targets = new Set(userIds);
    if (targets.size === 0) return;
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const c of clients) {
      if (targets.has(c.userId)) {
        try {
          c.res.write(payload);
        } catch {
          // socket likely closed; cleanup happens via 'close' handler
        }
      }
    }
  },

  broadcast(event: { type: string; data: unknown }): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const c of clients) {
      try {
        c.res.write(payload);
      } catch {
        // ignore
      }
    }
  },

  size(): number {
    return clients.size;
  },

  clear(): void {
    for (const c of clients) {
      try {
        c.res.end();
      } catch {
        // ignore
      }
    }
    clients.clear();
  },
};
