import chalk from "chalk";
import { EventEmitter } from "events";

import { getCollections } from "./db.js";
import type { LogEntry } from "../types/index.js";

export type LogLevel = "info" | "warn" | "error" | "http";

const emitter = new EventEmitter();

function colorize(level: LogLevel, message: string): string {
  switch (level) {
    case "info":
      return chalk.cyan(message);
    case "warn":
      return chalk.yellow(message);
    case "error":
      return chalk.red(message);
    case "http":
      return chalk.green(message);
    default:
      return message;
  }
}

async function persist(entry: LogEntry): Promise<void> {
  try {
    const { logs } = await getCollections();
    await logs.add(entry);
  } catch {
    // Best-effort logging only.
  }
}

function log(level: LogLevel, message: string, source?: string): void {
  const entry: LogEntry = {
    level,
    message,
    source,
    timestamp: Date.now()
  };

  const prefix = source ? `[${source}] ` : "";
  console.log(colorize(level, `${prefix}${message}`));
  emitter.emit("log", entry);
  void persist(entry);
}

export const logger = {
  info: (message: string, source?: string) => log("info", message, source),
  warn: (message: string, source?: string) => log("warn", message, source),
  error: (message: string, source?: string) => log("error", message, source),
  http: (message: string, source?: string) => log("http", message, source),
  on: (handler: (entry: LogEntry) => void) => emitter.on("log", handler),
  off: (handler: (entry: LogEntry) => void) => emitter.off("log", handler)
};

