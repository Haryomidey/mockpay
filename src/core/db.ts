import ChronoDB from "chronodb";
import fs from "fs/promises";

import { getConfig } from "./config";
import type {
  LogEntry,
  SettingEntry,
  TransactionRecord,
  TransferRecord,
  WebhookRecord
} from "../types/index";

let dbPromise: Promise<any> | null = null;
let collectionsPromise: Promise<Collections> | null = null;

export interface Collections {
  transactions: any;
  transfers: any;
  webhooks: any;
  settings: any;
  logs: any;
}

export async function getDb(): Promise<any> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}

export async function getCollections(): Promise<Collections> {
  if (!collectionsPromise) {
    collectionsPromise = initCollections();
  }
  return collectionsPromise;
}

async function openDb(): Promise<any> {
  const { dataDir } = getConfig();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    return await ChronoDB.open({ path: dataDir, cloudSync: false });
  } catch (err) {
    const previous = process.cwd();
    process.chdir(dataDir);
    try {
      return await ChronoDB.open({ cloudSync: false });
    } finally {
      process.chdir(previous);
    }
  }
}

async function initCollections(): Promise<Collections> {
  const db = await getDb();

  const transactions = db.col("transactions", {
    schema: {
      provider: { type: "string", important: true },
      reference: { type: "string", important: true, distinct: true },
      status: { type: "string", important: true },
      amount: { type: "number", important: true },
      currency: { type: "string", default: "NGN" },
      customerEmail: { type: "string", important: true },
      callbackUrl: { type: "string", nullable: true },
      metadata: { type: "string", nullable: true }
    },
    indexes: ["provider", "reference", "status"]
  });

  const transfers = db.col("transfers", {
    schema: {
      provider: { type: "string", important: true },
      reference: { type: "string", important: true, distinct: true },
      status: { type: "string", important: true },
      amount: { type: "number", important: true },
      currency: { type: "string", default: "NGN" },
      bankCode: { type: "string", nullable: true },
      accountNumber: { type: "string", nullable: true },
      narration: { type: "string", nullable: true },
      metadata: { type: "string", nullable: true }
    },
    indexes: ["provider", "reference", "status"]
  });

  const webhooks = db.col("webhooks", {
    schema: {
      provider: { type: "string", important: true },
      event: { type: "string", important: true },
      url: { type: "string", important: true },
      status: { type: "string", important: true },
      attempts: { type: "number", default: 0 },
      payload: { type: "string", important: true },
      lastAttemptAt: { type: "number", nullable: true }
    },
    indexes: ["provider", "event", "status"]
  });

  const settings = db.col("settings", {
    schema: {
      key: { type: "string", important: true, distinct: true },
      value: { type: "string", important: true }
    },
    indexes: ["key"]
  });

  const logs = db.col("logs", {
    schema: {
      level: { type: "string", important: true },
      message: { type: "string", important: true },
      source: { type: "string", nullable: true },
      timestamp: { type: "number", important: true }
    },
    indexes: ["level", "timestamp"]
  });

  return { transactions, transfers, webhooks, settings, logs } as Collections;
}