import { prisma } from '../src/db/prisma';

beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookSubscription.deleteMany();
  await prisma.apiToken.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.formSubmission.deleteMany();
  await prisma.formField.deleteMany();
  await prisma.form.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.budgetEntry.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.recurringTaskRule.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.projectTemplate.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
