import { Router } from "express";
import { usersRouter } from "./users";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { commentsRouter } from "./comments";
import { dashboardRouter } from "./dashboard";
import { notificationsRouter } from "./notifications";
import { reportsRouter } from "./reports";
import { formsRouter } from "./forms";
import { automationsRouter } from "./automations";
import { aiRouter } from "./ai";

export const router = Router();

router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/tasks", tasksRouter);
router.use("/comments", commentsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/notifications", notificationsRouter);
router.use("/reports", reportsRouter);
router.use("/forms", formsRouter);
router.use("/automations", automationsRouter);
router.use("/ai", aiRouter);
