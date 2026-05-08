import crypto from "node:crypto";
import { prisma } from "../prisma";

export function generateToken(): { token: string; prefix: string; hash: string } {
  // 32 random bytes -> 43-char base64url. Prefix with "pm_" so they're recognizable.
  const raw = crypto.randomBytes(32).toString("base64url");
  const token = `pm_${raw}`;
  const prefix = token.slice(0, 10); // "pm_" + 7 chars
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, prefix, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function resolveToken(token: string) {
  if (!token.startsWith("pm_")) return null;
  const hash = hashToken(token);
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hash } });
  if (!row || !row.isActive) return null;
  // Best-effort lastUsedAt update (don't block on it).
  prisma.apiToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return row;
}
