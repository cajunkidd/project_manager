import { Router } from "express";
import { usersRouter } from "./users";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { commentsRouter } from "./comments";
import { dashboardRouter } from "./dashboard";

export const router = Router();

router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/tasks", tasksRouter);
router.use("/comments", commentsRouter);
router.use("/dashboard", dashboardRouter);
