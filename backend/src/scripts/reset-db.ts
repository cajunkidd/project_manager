/**
 * One-shot CLI: wipe ALL data from the database (every table). After running,
 * the schema is intact but every row is gone, so registering the first user
 * starts the workspace from scratch — and the configured master email gets
 * auto-promoted on creation.
 *
 * Usage:
 *   npm run reset-db --workspace @project-manager/backend
 *
 * Destructive: this is irreversible. Requires CONFIRM_RESET=yes to actually
 * run, so it can't be triggered by accident.
 */
import { prisma } from '../db/prisma';

async function main() {
  if (process.env.CONFIRM_RESET !== 'yes') {
    // eslint-disable-next-line no-console
    console.error(
      'Refusing to wipe the database without confirmation.\n' +
        'Re-run with:  CONFIRM_RESET=yes npm run reset-db --workspace @project-manager/backend',
    );
    process.exit(1);
  }

  // Delete in dependency order — children before parents — to avoid FK errors.
  // The list mirrors the test cleanup in tests/setupAfterEnv.ts.
  const counts = {
    webhookDelivery: await prisma.webhookDelivery.deleteMany(),
    webhookSubscription: await prisma.webhookSubscription.deleteMany(),
    apiToken: await prisma.apiToken.deleteMany(),
    emailLog: await prisma.emailLog.deleteMany(),
    formSubmission: await prisma.formSubmission.deleteMany(),
    formField: await prisma.formField.deleteMany(),
    form: await prisma.form.deleteMany(),
    automationRule: await prisma.automationRule.deleteMany(),
    notification: await prisma.notification.deleteMany(),
    activityLog: await prisma.activityLog.deleteMany(),
    comment: await prisma.comment.deleteMany(),
    task: await prisma.task.deleteMany(),
    project: await prisma.project.deleteMany(),
    user: await prisma.user.deleteMany(),
  };

  // eslint-disable-next-line no-console
  console.log('Database reset complete. Rows deleted:');
  for (const [table, result] of Object.entries(counts)) {
    // eslint-disable-next-line no-console
    console.log(`  ${table.padEnd(22)} ${result.count}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
