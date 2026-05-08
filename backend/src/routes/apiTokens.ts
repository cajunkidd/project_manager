import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { generateToken } from "../lib/tokens";

export const apiTokensRouter = Router();

apiTokensRouter.get("/", async (_req, res) => {
  const tokens = await prisma.apiToken.findMany({
    select: {
      id: true,
      name: true,
      prefix: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(tokens);
});

apiTokensRouter.post("/", async (req, res) => {
  const { name, createdById } = z
    .object({
      name: z.string().min(1),
      createdById: z.string().uuid().optional().nullable(),
    })
    .parse(req.body);
  const { token, prefix, hash } = generateToken();
  const row = await prisma.apiToken.create({
    data: {
      name,
      prefix,
      tokenHash: hash,
      createdById: createdById ?? null,
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });
  // The plaintext token is returned exactly once.
  res.status(201).json({ ...row, token });
});

apiTokensRouter.delete("/:id", async (req, res) => {
  await prisma.apiToken.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.status(204).end();
});
