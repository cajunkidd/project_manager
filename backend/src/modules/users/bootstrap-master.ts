import { prisma } from '../../db/prisma';

/**
 * Email of the designated master (super-admin) account. Promoting this user on
 * boot guarantees there is always exactly one master account configured, even
 * if the database has been reset or migrated.
 *
 * Overridable via the MASTER_ACCOUNT_EMAIL env var so deployments outside the
 * default workspace can use their own owner.
 */
export const MASTER_ACCOUNT_EMAIL = (
  process.env.MASTER_ACCOUNT_EMAIL ?? 'kyle.neely27@gmail.com'
).toLowerCase();

export async function ensureMasterAccount(): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: MASTER_ACCOUNT_EMAIL } },
  });
  if (!user) return; // user hasn't registered yet — promote on first sight
  if (user.role === 'master' && user.isActive) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'master', isActive: true },
  });
}

/**
 * If the given user is the configured master email but doesn't yet have the
 * master role, promote them and return the new role. Otherwise return the
 * current role unchanged. Safe to call on every auth touchpoint.
 */
export async function promoteIfMasterEmail(
  id: string,
  email: string,
  currentRole: string,
): Promise<string> {
  if (email.toLowerCase() !== MASTER_ACCOUNT_EMAIL) return currentRole;
  if (currentRole === 'master') return currentRole;
  await prisma.user.update({ where: { id }, data: { role: 'master', isActive: true } });
  return 'master';
}
