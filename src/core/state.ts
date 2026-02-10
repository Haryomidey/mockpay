import { getCollections } from "./db";
import { getConfig } from "./config";

export type PaymentResult = "success" | "failed" | "cancelled";
export type NextError = "none" | "500" | "timeout" | "network";

export interface WebhookConfig {
  delayMs: number;
  duplicate: boolean;
  drop: boolean;
  retryCount: number;
  retryDelayMs: number;
}

const NEXT_PAYMENT_KEY = "next_payment_result";
const NEXT_ERROR_KEY = "next_error";
const WEBHOOK_CONFIG_KEY = "webhook_config";
const LAST_WEBHOOK_KEY = "last_webhook";

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { settings } = await getCollections();
  const existing = await settings.getOne({ key });
  if (!existing) return fallback;
  try {
    return JSON.parse(existing.value) as T;
  } catch {
    return fallback;
  }
}

async function setSetting<T>(key: string, value: T): Promise<void> {
  const { settings } = await getCollections();
  const existing = await settings.getOne({ key });
  const payload = JSON.stringify(value);
  if (existing) {
    await settings.updateById(existing.id, { value: payload });
  } else {
    await settings.add({ key, value: payload });
  }
}

export async function takeNextPaymentResult(): Promise<PaymentResult> {
  const current = await getSetting<PaymentResult>(NEXT_PAYMENT_KEY, "success");
  await setSetting(NEXT_PAYMENT_KEY, "success");
  return current;
}

export async function setNextPaymentResult(result: PaymentResult): Promise<void> {
  await setSetting(NEXT_PAYMENT_KEY, result);
}

export async function takeNextError(): Promise<NextError> {
  const current = await getSetting<NextError>(NEXT_ERROR_KEY, "none");
  await setSetting(NEXT_ERROR_KEY, "none");
  return current;
}

export async function setNextError(error: NextError): Promise<void> {
  await setSetting(NEXT_ERROR_KEY, error);
}

export async function getWebhookConfig(): Promise<WebhookConfig> {
  const config = getConfig();
  const fallback: WebhookConfig = {
    delayMs: config.webhookDelayMs,
    duplicate: config.webhookDuplicate,
    drop: config.webhookDrop,
    retryCount: config.webhookRetryCount,
    retryDelayMs: config.webhookRetryDelayMs
  };
  return getSetting<WebhookConfig>(WEBHOOK_CONFIG_KEY, fallback);
}

export async function setWebhookConfig(value: WebhookConfig): Promise<void> {
  await setSetting(WEBHOOK_CONFIG_KEY, value);
}

export async function setLastWebhook(value: unknown): Promise<void> {
  await setSetting(LAST_WEBHOOK_KEY, value);
}

export async function getLastWebhook<T>(): Promise<T | null> {
  return getSetting<T | null>(LAST_WEBHOOK_KEY, null);
}

export async function resetState(): Promise<void> {
  await setSetting(NEXT_PAYMENT_KEY, "success");
  await setSetting(NEXT_ERROR_KEY, "none");
  await setWebhookConfig(await getWebhookConfig());
}
