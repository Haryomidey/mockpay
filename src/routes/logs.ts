import type { Request, Response } from "express";
import { logger } from "../core/logger";
import type { LogEntry } from "../types/index";

export function logsRoute(_req: Request, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  const send = (entry: LogEntry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };

  logger.on(send);

  const interval = setInterval(() => {
    res.write(":keep-alive\n\n");
  }, 15000);

  res.on("close", () => {
    clearInterval(interval);
    logger.off(send);
    res.end();
  });
}
