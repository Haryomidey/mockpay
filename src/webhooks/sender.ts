import { getCollections } from "../core/db";
import { getConfig } from "../core/config";
import { getWebhookConfig, setLastWebhook } from "../core/state";
import { logger } from "../core/logger";

export interface WebhookPayload {
  provider: "paystack" | "flutterwave";
  event: string;
  url: string;
  payload: Record<string, unknown>;
}

async function attemptSend(url: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  const config = await getWebhookConfig();
  const { webhooks } = await getCollections();

  await setLastWebhook(payload);

  if (config.drop) {
    await webhooks.add({
      provider: payload.provider,
      event: payload.event,
      url: payload.url,
      status: "dropped",
      attempts: 0,
      payload: JSON.stringify(payload.payload),
      lastAttemptAt: Date.now()
    });
    logger.warn(`Webhook dropped for ${payload.provider} ${payload.event}`, "webhook");
    return;
  }

  const record = await webhooks.add({
    provider: payload.provider,
    event: payload.event,
    url: payload.url,
    status: "pending",
    attempts: 0,
    payload: JSON.stringify(payload.payload),
    lastAttemptAt: null
  });

  const sendOnce = async (): Promise<boolean> => {
    try {
      await new Promise((resolve) => setTimeout(resolve, config.delayMs));
      const res = await attemptSend(payload.url, payload.payload);
      const ok = res.ok;
      await webhooks.updateById(record.id, {
        status: ok ? "sent" : "failed",
        attempts: record.attempts + 1,
        lastAttemptAt: Date.now()
      });
      logger.info(`Webhook ${ok ? "sent" : "failed"} to ${payload.url}`, "webhook");
      return ok;
    } catch (err) {
      await webhooks.updateById(record.id, {
        status: "failed",
        attempts: record.attempts + 1,
        lastAttemptAt: Date.now()
      });
      logger.error(`Webhook error to ${payload.url}`, "webhook");
      return false;
    }
  };

  const first = await sendOnce();
  if (config.duplicate) {
    await sendOnce();
  }

  if (!first && config.retryCount > 0) {
    for (let i = 0; i < config.retryCount; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs));
      const ok = await sendOnce();
      if (ok) break;
    }
  }
}

export async function resendLastWebhook(): Promise<boolean> {
  const last = await getLastWebhookPayload();
  if (!last) return false;
  await sendWebhook(last);
  return true;
}

async function getLastWebhookPayload(): Promise<WebhookPayload | null> {
  const { defaultWebhookUrl } = getConfig();
  const last = await getLastWebhookPayloadRaw();
  if (!last) return null;
  if (!last.url && defaultWebhookUrl) {
    return { ...last, url: defaultWebhookUrl };
  }
  return last;
}

async function getLastWebhookPayloadRaw(): Promise<WebhookPayload | null> {
  const { getLastWebhook } = await import("../core/state");
  return getLastWebhook<WebhookPayload>();
}
