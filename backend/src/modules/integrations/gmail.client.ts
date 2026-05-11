// Minimal Gmail API + OAuth client. Uses fetch so we don't pull in the
// googleapis SDK. The HTTP transport is swappable so tests can stub Gmail
// without touching the network.

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

let transport: FetchLike = fetch as unknown as FetchLike;
export function setGmailTransport(t: FetchLike | null): void {
  transport = (t ?? (fetch as unknown as FetchLike));
}

export const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildAuthorizeUrl(cfg: OAuthClientConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_OAUTH_SCOPES.join(' '),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCode(
  cfg: OAuthClientConfig,
  code: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  }).toString();
  const res = await transport(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  cfg: OAuthClientConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
  }).toString();
  const res = await transport(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await transport(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed (${res.status})`);
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error('userinfo returned no email');
  return data.email;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
  headers?: GmailMessageHeader[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePart;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 20,
): Promise<{ id: string; threadId?: string }[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const res = await transport(`${GMAIL_BASE}/messages?${params.toString()}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`messages.list failed (${res.status})`);
  const data = (await res.json()) as { messages?: { id: string; threadId?: string }[] };
  return data.messages ?? [];
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const res = await transport(`${GMAIL_BASE}/messages/${id}?format=full`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`messages.get failed (${res.status})`);
  return (await res.json()) as GmailMessage;
}

export async function modifyMessageLabels(
  accessToken: string,
  id: string,
  patch: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<void> {
  const res = await transport(`${GMAIL_BASE}/messages/${id}/modify`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`messages.modify failed (${res.status})`);
}

export async function listLabels(
  accessToken: string,
): Promise<{ id: string; name: string }[]> {
  const res = await transport(`${GMAIL_BASE}/labels`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`labels.list failed (${res.status})`);
  const data = (await res.json()) as { labels?: { id: string; name: string }[] };
  return data.labels ?? [];
}

export async function createLabel(accessToken: string, name: string): Promise<{ id: string; name: string }> {
  const res = await transport(`${GMAIL_BASE}/labels`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
  });
  if (!res.ok) throw new Error(`labels.create failed (${res.status})`);
  return (await res.json()) as { id: string; name: string };
}

export async function sendMessage(
  accessToken: string,
  rfc822: string,
): Promise<{ id: string }> {
  const raw = Buffer.from(rfc822, 'utf8').toString('base64url');
  const res = await transport(`${GMAIL_BASE}/messages/send`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`messages.send failed (${res.status})`);
  return (await res.json()) as { id: string };
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export function extractHeader(payload: GmailMessagePart | undefined, name: string): string | null {
  if (!payload?.headers) return null;
  const found = payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

export function extractPlainBody(payload: GmailMessagePart | undefined): string {
  if (!payload) return '';
  const stack: GmailMessagePart[] = [payload];
  while (stack.length) {
    const part = stack.pop()!;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) for (const p of part.parts) stack.push(p);
  }
  // Fallback: any body data
  const stack2: GmailMessagePart[] = [payload];
  while (stack2.length) {
    const part = stack2.pop()!;
    if (part.body?.data) return decodeBase64Url(part.body.data);
    if (part.parts) for (const p of part.parts) stack2.push(p);
  }
  return '';
}
