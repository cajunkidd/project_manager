import { prisma } from "../prisma";
import { notify } from "./notify";

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g;

export function extractMentionTokens(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) out.add(m[1].toLowerCase());
  return [...out];
}

export async function resolveMentionsToUsers(tokens: string[]) {
  if (tokens.length === 0) return [];
  // Match against the username portion of the email (case-insensitive).
  // e.g. "@admin" matches admin@example.com.
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: tokens.map((t) => ({
        email: { startsWith: `${t}@`, mode: "insensitive" as const },
      })),
    },
  });
  return users;
}

export async function notifyMentions(args: {
  body: string;
  authorId: string | null;
  title: string;
  entityType: "task" | "project";
  entityId: string;
}) {
  const tokens = extractMentionTokens(args.body);
  if (tokens.length === 0) return;
  const users = await resolveMentionsToUsers(tokens);
  for (const u of users) {
    if (u.id === args.authorId) continue;
    await notify({
      userId: u.id,
      title: args.title,
      message: args.body.slice(0, 240),
      type: "mention",
      entityType: args.entityType,
      entityId: args.entityId,
    });
  }
}
