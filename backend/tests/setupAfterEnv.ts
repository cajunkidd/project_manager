import { prisma } from '../src/db/prisma';

beforeEach(async () => {
  // SQLite-friendly clean: delete in FK-safe order.
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
