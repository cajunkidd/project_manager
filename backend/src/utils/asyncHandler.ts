import type { NextFunction, Request, RequestHandler, Response } from 'express';

type RouteParams = Record<string, string>;

export type TypedRequest = Request<RouteParams> & {
  params: RouteParams;
};

export function asyncHandler(
  fn: (req: TypedRequest, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as unknown as TypedRequest, res, next)).catch(next);
  };
}
