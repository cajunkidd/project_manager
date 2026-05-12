#!/usr/bin/env ts-node
/**
 * Promote a user to admin (the highest role in the current schema).
 *
 * Usage:
 *   cd backend
 *   npx ts-node scripts/promote-admin.ts <email>
 *
 * Example:
 *   npx ts-node scripts/promote-admin.ts kyleneely27@gmail.com
 *
 * The script connects with whatever DATABASE_URL the backend is configured
 * to use (SQLite by default, Postgres if you've switched the provider).
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: ts-node scripts/promote-admin.ts <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      console.error(`No user found with email "${email}". Have they registered yet?`);
      process.exit(2);
    }

    if (existing.role === 'admin') {
      console.log(`${email} is already admin — nothing to do.`);
      return;
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'admin' },
    });
    console.log(`Promoted ${updated.email} (${updated.displayName}): ${existing.role} → ${updated.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
