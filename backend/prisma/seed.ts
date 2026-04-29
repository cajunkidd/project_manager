import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      displayName: 'System Admin',
      password: hashedPassword,
      role: 'admin',
      department: 'IT',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@company.com' },
    update: {},
    create: {
      email: 'manager@company.com',
      displayName: 'IT Manager',
      password: await bcrypt.hash('Manager123!', 10),
      role: 'manager',
      department: 'IT',
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'john@company.com' },
    update: {},
    create: {
      email: 'john@company.com',
      displayName: 'John Smith',
      password: await bcrypt.hash('User123!', 10),
      role: 'user',
      department: 'IT',
    },
  });

  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'IT Infrastructure Upgrade',
      description: 'Upgrade network infrastructure across all locations.',
      ownerId: manager.id,
      status: 'active',
      priority: 'high',
      department: 'IT',
      createdById: admin.id,
    },
  });

  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        projectId: project.id,
        title: 'Replace core switch in main office',
        description: 'Procure and install new Cisco Catalyst 9300 switch.',
        status: 'in_progress',
        priority: 'high',
        assignedTo: user1.id,
        createdById: manager.id,
      },
      {
        projectId: project.id,
        title: 'Update network documentation',
        description: 'Document all changes to the network topology.',
        status: 'to_do',
        priority: 'normal',
        assignedTo: user1.id,
        createdById: manager.id,
      },
      {
        projectId: project.id,
        title: 'Test failover configuration',
        description: 'Verify redundancy and failover settings are working correctly.',
        status: 'backlog',
        priority: 'normal',
        createdById: manager.id,
      },
    ],
  });

  console.log('Seed complete.');
  console.log('Admin:   admin@company.com / Admin123!');
  console.log('Manager: manager@company.com / Manager123!');
  console.log('User:    john@company.com / User123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
