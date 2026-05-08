import type { RequestHandler } from "express";
import { HttpError } from "./error";
import { resolveToken } from "../lib/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiTokenId?: string;
    }
  }
}

export const requireToken: RequestHandler = async (req, _res, next) => {
  const auth = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return next(new HttpError(401, "missing_bearer_token"));
  const row = await resolveToken(m[1]);
  if (!row) return next(new HttpError(401, "invalid_token"));
  req.apiTokenId = row.id;
  next();
};
