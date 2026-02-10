import type { Request, Response, NextFunction } from "express";
import { takeNextError } from "../../core/state.js";
import { logger } from "../../core/logger.js";

export async function errorSimulation(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const nextError = await takeNextError();
  if (nextError === "none") {
    next();
    return;
  }

  logger.warn(`Simulating ${nextError} error`, "middleware");

  if (nextError === "500") {
    res.status(500).json({ status: false, message: "Mockpay simulated 500 error" });
    return;
  }

  if (nextError === "timeout") {
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ status: false, message: "Mockpay simulated timeout" });
      }
    }, 15000);
    return;
  }

  if (nextError === "network") {
    setTimeout(() => {
      _req.socket.destroy();
    }, 50);
    return;
  }

  next();
}

