import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error";
import { router } from "./routes";
import { startOverdueScanner } from "./lib/overdueScanner";
import { startDigestScheduler } from "./lib/digestScheduler";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);

app.use(errorHandler);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${port}`);
  startOverdueScanner();
  startDigestScheduler();
});
