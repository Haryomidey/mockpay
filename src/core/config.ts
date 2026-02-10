import dotenv from "dotenv";
import path from "path";

dotenv.config();

export interface Config {
  paystackPort: number;
  flutterwavePort: number;
  dataDir: string;
  frontendUrl?: string;
  defaultWebhookUrl?: string;
  webhookDelayMs: number;
  webhookRetryCount: number;
  webhookRetryDelayMs: number;
  webhookDuplicate: boolean;
  webhookDrop: boolean;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function toNum(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getConfig(): Config {
  const baseDir = process.cwd();
  const dataDir = process.env.MOCKPAY_DATA_DIR
    ? path.resolve(baseDir, process.env.MOCKPAY_DATA_DIR)
    : path.resolve(baseDir, ".mockpay", "data");

  return {
    paystackPort: toNum(process.env.MOCKPAY_PAYSTACK_PORT, 4010),
    flutterwavePort: toNum(process.env.MOCKPAY_FLUTTERWAVE_PORT, 4020),
    dataDir,
    frontendUrl: process.env.MOCKPAY_FRONTEND_URL || undefined,
    defaultWebhookUrl: process.env.MOCKPAY_DEFAULT_WEBHOOK_URL || undefined,
    webhookDelayMs: toNum(process.env.MOCKPAY_WEBHOOK_DELAY_MS, 1500),
    webhookRetryCount: toNum(process.env.MOCKPAY_WEBHOOK_RETRY_COUNT, 0),
    webhookRetryDelayMs: toNum(process.env.MOCKPAY_WEBHOOK_RETRY_DELAY_MS, 2000),
    webhookDuplicate: toBool(process.env.MOCKPAY_WEBHOOK_DUPLICATE, false),
    webhookDrop: toBool(process.env.MOCKPAY_WEBHOOK_DROP, false)
  };
}