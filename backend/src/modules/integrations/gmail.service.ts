import crypto from 'node:crypto';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { ValidationError } from '../../utils/errors';
import { tasksService } from '../tasks/tasks.service';
import {
  buildAuthorizeUrl,
  createLabel,
  exchangeCode,
  extractHeader,
  extractPlainBody,
  fetchUserEmail,
  getMessage,
  listLabels,
  listMessages,
  modifyMessageLabels,
  refreshAccessToken,
  sendMessage,
  type OAuthClientConfig,
} from './gmail.client';

const STATE_TTL_MS = 10 * 60_000;

function oauthConfig(redirectUri: string): OAuthClientConfig {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ValidationError(
      'Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.',
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GMAIL_REDIRECT_URI ?? redirectUri,
  };
}

function signState(userId: string, nonce: string, issuedAt: number): string {
  const payload = `${userId}.${nonce}.${issuedAt}`;
  const sig = crypto.createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state: string, now = Date.now()): string {
  const parts = state.split('.');
  if (parts.length !== 4) throw new ValidationError('Invalid OAuth state');
  const [userId, nonce, issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || now - issuedAt > STATE_TTL_MS) {
    throw new ValidationError('OAuth state expired');
  }
  const expected = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${userId}.${nonce}.${issuedAtStr}`)
    .digest('base64url');
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    throw new ValidationError('Invalid OAuth state signature');
  }
  return userId;
}

function expiresAtFromNow(seconds: number): Date {
  return new Date(Date.now() + Math.max(0, seconds - 60) * 1000);
}

async function ensureAccessToken(connection: {
  id: string;
  accessToken: string | null;
  refreshToken: string;
  expiresAt: Date | null;
}, redirectUri: string): Promise<string> {
  if (connection.accessToken && connection.expiresAt && connection.expiresAt > new Date()) {
    return connection.accessToken;
  }
  const cfg = oauthConfig(redirectUri);
  const refreshed = await refreshAccessToken(cfg, connection.refreshToken);
  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      expiresAt: expiresAtFromNow(refreshed.expires_in),
    },
  });
  return refreshed.access_token;
}

async function ensureLabelId(accessToken: string, labelName: string): Promise<string> {
  const labels = await listLabels(accessToken);
  const existing = labels.find((l) => l.name === labelName);
  if (existing) return existing.id;
  const created = await createLabel(accessToken, labelName);
  return created.id;
}

export interface PollResult {
  connectionId: string;
  processed: number;
  taskIds: string[];
  error?: string;
}

export const gmailService = {
  buildRedirectUri(host: string): string {
    return process.env.GMAIL_REDIRECT_URI ?? `${host}/api/integrations/gmail/oauth/callback`;
  },

  authorizeUrl(userId: string, redirectUri: string): string {
    const cfg = oauthConfig(redirectUri);
    const nonce = crypto.randomBytes(8).toString('base64url');
    const state = signState(userId, nonce, Date.now());
    return buildAuthorizeUrl(cfg, state);
  },

  async completeOAuth(code: string, state: string, redirectUri: string) {
    const userId = verifyState(state);
    const cfg = oauthConfig(redirectUri);
    const tokens = await exchangeCode(cfg, code);
    if (!tokens.refresh_token) {
      throw new ValidationError(
        'Google did not return a refresh token. Revoke previous access at https://myaccount.google.com/permissions and retry.',
      );
    }
    const email = await fetchUserEmail(tokens.access_token);
    const existing = await prisma.gmailConnection.findUnique({ where: { userId } });
    const data = {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAtFromNow(tokens.expires_in),
      scopes: tokens.scope,
      isActive: true,
      lastError: null,
    };
    if (existing) {
      return prisma.gmailConnection.update({ where: { userId }, data });
    }
    return prisma.gmailConnection.create({ data: { userId, ...data } });
  },

  async status(userId: string) {
    const c = await prisma.gmailConnection.findUnique({ where: { userId } });
    if (!c) return { connected: false as const };
    return {
      connected: true as const,
      email: c.email,
      labelName: c.labelName,
      lastPolledAt: c.lastPolledAt,
      lastError: c.lastError,
      isActive: c.isActive,
    };
  },

  async setLabel(userId: string, labelName: string) {
    const trimmed = labelName.trim();
    if (!trimmed) throw new ValidationError('Label name required');
    return prisma.gmailConnection.update({
      where: { userId },
      data: { labelName: trimmed },
    });
  },

  async disconnect(userId: string) {
    await prisma.gmailConnection
      .delete({ where: { userId } })
      .catch(() => undefined);
  },

  async pollConnection(connectionId: string, redirectUri: string): Promise<PollResult> {
    const connection = await prisma.gmailConnection.findUnique({
      where: { id: connectionId },
      include: { user: true },
    });
    if (!connection || !connection.isActive) {
      return { connectionId, processed: 0, taskIds: [] };
    }
    try {
      const accessToken = await ensureAccessToken(connection, redirectUri);
      const labelId = await ensureLabelId(accessToken, connection.labelName);
      const messages = await listMessages(
        accessToken,
        `label:${connection.labelName} is:unread`,
        25,
      );
      const taskIds: string[] = [];
      for (const ref of messages) {
        const full = await getMessage(accessToken, ref.id);
        const subject = extractHeader(full.payload, 'Subject') ?? '(no subject)';
        const from = extractHeader(full.payload, 'From') ?? connection.email;
        const body = extractPlainBody(full.payload) || full.snippet || '';
        const isUrgent = /(\burgent\b|\basap\b|\bemergency\b|\bp0\b)/i.test(`${subject} ${body}`);

        const task = await tasksService.create(
          {
            title: subject.trim() || '(no subject)',
            description: `From: ${from}\n\n${body}`.trim(),
            status: 'to_do',
            priority: isUrgent ? 'urgent' : 'normal',
            assignedToId: connection.userId,
          },
          connection.userId,
        );
        taskIds.push(task.id);

        await prisma.emailLog.create({
          data: {
            direction: 'inbound',
            fromAddress: from,
            toAddress: connection.email,
            subject,
            body,
            meta: JSON.stringify({ source: 'gmail', gmailId: ref.id, taskId: task.id }),
          },
        });

        await modifyMessageLabels(accessToken, ref.id, {
          removeLabelIds: ['UNREAD', labelId],
        });
      }
      await prisma.gmailConnection.update({
        where: { id: connection.id },
        data: { lastPolledAt: new Date(), lastError: null },
      });
      return { connectionId, processed: messages.length, taskIds };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.gmailConnection.update({
        where: { id: connection.id },
        data: { lastError: message, lastPolledAt: new Date() },
      });
      return { connectionId, processed: 0, taskIds: [], error: message };
    }
  },

  async pollAll(redirectUri: string): Promise<PollResult[]> {
    const connections = await prisma.gmailConnection.findMany({ where: { isActive: true } });
    const out: PollResult[] = [];
    for (const c of connections) {
      out.push(await gmailService.pollConnection(c.id, redirectUri));
    }
    return out;
  },

  // Sends an email AS the connected user. Returns null if the user has no
  // active connection — callers can fall back to the system provider.
  async sendAsUser(
    userId: string,
    to: string,
    subject: string,
    body: string,
    redirectUri: string,
  ): Promise<{ id: string } | null> {
    const connection = await prisma.gmailConnection.findUnique({ where: { userId } });
    if (!connection || !connection.isActive) return null;
    const accessToken = await ensureAccessToken(connection, redirectUri);
    const rfc822 = [
      `From: ${connection.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n');
    return sendMessage(accessToken, rfc822);
  },
};
