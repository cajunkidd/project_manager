import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../utils/errors';
import { apiTokensService } from './api-tokens.service';

export function tokenAuth(requiredScope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing API token'));
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    apiTokensService
      .verify(token)
      .then((record) => {
        if (!apiTokensService.hasScope(record, requiredScope)) {
          next(new ForbiddenError(`Token missing required scope: ${requiredScope}`));
          return;
        }
        (req as Request & { tokenId?: string }).tokenId = record.id;
        next();
      })
      .catch(next);
  };
}
