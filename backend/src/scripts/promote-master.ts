/**
 * One-shot CLI: promote the configured master email to the `master` role.
 *
 * Usage:
 *   npm run promote-master --workspace @project-manager/backend
 *   MASTER_ACCOUNT_EMAIL=someone@example.com npm run promote-master ...
 */
import { prisma } from '../db/prisma';
import { MASTER_ACCOUNT_EMAIL, ensureMasterAccount } from '../modules/users/bootstrap-master';

async function main() {
  const before = await prisma.user.findFirst({
    where: { email: { equals: MASTER_ACCOUNT_EMAIL } },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!before) {
    // eslint-disable-next-line no-console
    console.error(
      `No user found with email ${MASTER_ACCOUNT_EMAIL}. Register that ` +
        `account first (it will be auto-promoted), or set MASTER_ACCOUNT_EMAIL.`,
    );
    process.exit(1);
  }

  await ensureMasterAccount();

  const after = await prisma.user.findUnique({
    where: { id: before.id },
    select: { id: true, email: true, role: true, isActive: true },
  });

  // eslint-disable-next-line no-console
  console.log(`Promoted: ${before.email} ${before.role} -> ${after?.role}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
