import type { Request, Response, NextFunction } from "express";
import { logger } from "../../core/logger";

export function requestLogger(source: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    logger.http(`${req.method} ${req.path}`, source);
    next();
  };
}
