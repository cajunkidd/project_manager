import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      displayName: "Admin User",
      role: "admin",
      department: "IT",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      displayName: "IT Manager",
      role: "manager",
      department: "IT",
    },
  });

  const tech = await prisma.user.upsert({
    where: { email: "tech@example.com" },
    update: {},
    create: {
      email: "tech@example.com",
      displayName: "Network Tech",
      role: "user",
      department: "IT",
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Lake Charles Network Refresh",
      description: "Replace aging switches and verify cabling at the Lake Charles site.",
      ownerId: manager.id,
      createdById: admin.id,
      status: "active",
      priority: "high",
      department: "IT",
      startDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        title: "Replace switch in Lake Charles",
        status: "in_progress",
        priority: "high",
        assignedToId: tech.id,
        createdById: manager.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Verify cabling",
        status: "to_do",
        priority: "normal",
        assignedToId: tech.id,
        createdById: manager.id,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Update documentation",
        status: "backlog",
        priority: "normal",
        createdById: manager.id,
      },
      {
        projectId: project.id,
        title: "Notify store manager once complete",
        status: "waiting",
        priority: "normal",
        assignedToId: manager.id,
        createdById: manager.id,
      },
    ],
  });

  const existingForm = await prisma.form.findFirst({ where: { name: "IT Request" } });
  if (!existingForm) {
    await prisma.form.create({
      data: {
        name: "IT Request",
        description: "Submit an IT support or project request.",
        defaultProjectId: project.id,
        defaultAssigneeId: manager.id,
        defaultPriority: "normal",
        createdById: admin.id,
        fields: {
          create: [
            { label: "Summary", fieldType: "text", isRequired: true, sortOrder: 0 },
            { label: "Details", fieldType: "textarea", isRequired: true, sortOrder: 1 },
            {
              label: "Category",
              fieldType: "dropdown",
              isRequired: true,
              options: ["Hardware", "Software", "Network", "Access", "Other"] as never,
              sortOrder: 2,
            },
            { label: "Needed by", fieldType: "date", sortOrder: 3 },
            { label: "Urgent?", fieldType: "checkbox", sortOrder: 4 },
            { label: "Assign to", fieldType: "user_picker", sortOrder: 5 },
          ],
        },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete:", { project: project.name });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
