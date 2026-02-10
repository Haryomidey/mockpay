#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";

import {
  setNextPaymentResult,
  setNextError,
  getWebhookConfig,
  setWebhookConfig
} from "../core/state.js";
import { readRuntime, writeRuntime, clearRuntime, isPidRunning } from "../core/runtime.js";
import { resendLastWebhook } from "../webhooks/sender.js";
import { getCollections, getDb } from "../core/db.js";
import { getConfig } from "../core/config.js";

const program = new Command();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name("mockpay")
  .description("Local Paystack + Flutterwave mock servers")
  .version("0.1.0");

program
  .command("start")
  .description("Start mock servers")
  .action(async () => {
    const runtime = await readRuntime();
    if (runtime && isPidRunning(runtime.pid)) {
      console.log(chalk.yellow(`Mockpay already running (pid ${runtime.pid})`));
      return;
    }

    const config = getConfig();
    const isHealthy = async () => {
      const targets = [
        `http://localhost:${config.paystackPort}/__health`,
        `http://localhost:${config.flutterwavePort}/__health`
      ];
      for (const url of targets) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          if (res.ok) return true;
        } catch {
          // ignore
        }
      }
      return false;
    };

    if (await isHealthy()) {
      console.log(chalk.yellow("Mockpay already running"));
      return;
    }

    const jsServerPath = path.resolve(__dirname, "..", "server", "index.js");
    const tsServerPath = path.resolve(__dirname, "..", "server", "index.ts");
    const serverPath = fs.existsSync(jsServerPath) ? jsServerPath : tsServerPath;
    const child = spawn(process.execPath, [serverPath], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();

    if (!child.pid) {
      console.log(chalk.red("Failed to start mock servers"));
      return;
    }

    await writeRuntime(child.pid);
    console.log(chalk.green(`Mockpay started (pid ${child.pid})`));
    console.log(chalk.gray(`Paystack: http://localhost:${config.paystackPort}`));
    console.log(chalk.gray(`Flutterwave: http://localhost:${config.flutterwavePort}`));
  });

program
  .command("stop")
  .description("Stop mock servers")
  .action(async () => {
    const runtime = await readRuntime();
    if (!runtime || !isPidRunning(runtime.pid)) {
      console.log(chalk.yellow("Mockpay is not running"));
      await clearRuntime();
      return;
    }

    try {
      process.kill(runtime.pid);
      await clearRuntime();
      console.log(chalk.green("Mockpay stopped"));
    } catch {
      console.log(chalk.red(`Failed to stop process ${runtime.pid}`));
    }
  });

program
  .command("status")
  .description("Show running services")
  .action(async () => {
    const config = getConfig();
    const targets = [
      { name: "Paystack", url: `http://localhost:${config.paystackPort}/__health` },
      { name: "Flutterwave", url: `http://localhost:${config.flutterwavePort}/__health` }
    ];

    const results = await Promise.all(
      targets.map(async (target) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(target.url, { signal: controller.signal });
          clearTimeout(timeout);
          return { name: target.name, ok: res.ok };
        } catch {
          return { name: target.name, ok: false };
        }
      })
    );

    const running = results.filter((r) => r.ok);
    if (running.length === 0) {
      console.log(chalk.yellow("Not running"));
      return;
    }

    running.forEach((r) => console.log(chalk.green(`${r.name} running`)));
  });

program
  .command("pay")
  .description("Set next payment result")
  .argument("<result>", "success|fail|cancel")
  .action(async (result: string) => {
    const map: Record<string, "success" | "failed" | "cancelled"> = {
      success: "success",
      fail: "failed",
      cancel: "cancelled"
    };
    const mapped = map[result];
    if (!mapped) {
      console.log(chalk.red("Expected success|fail|cancel"));
      return;
    }
    await setNextPaymentResult(mapped);
    console.log(chalk.green(`Next payment result set to ${mapped}`));
  });

program
  .command("error")
  .description("Simulate next request failure")
  .argument("<type>", "500|timeout|network")
  .action(async (type: string) => {
    const allowed = ["500", "timeout", "network"] as const;
    if (!allowed.includes(type as any)) {
      console.log(chalk.red("Expected 500|timeout|network"));
      return;
    }
    await setNextError(type as "500" | "timeout" | "network");
    console.log(chalk.green(`Next error set to ${type}`));
  });

const webhook = program.command("webhook").description("Webhook actions");
webhook
  .command("resend")
  .description("Resend last webhook")
  .action(async () => {
    const ok = await resendLastWebhook();
    if (ok) {
      console.log(chalk.green("Webhook resent"));
    } else {
      console.log(chalk.yellow("No webhook to resend"));
    }
  });

webhook
  .command("config")
  .description("View or update webhook behavior")
  .option("--delay <ms>", "Delay before sending")
  .option("--retry <count>", "Retry count")
  .option("--retry-delay <ms>", "Retry delay")
  .option("--duplicate", "Send duplicate webhook")
  .option("--no-duplicate", "Disable duplicate webhook")
  .option("--drop", "Drop webhook")
  .option("--no-drop", "Disable drop")
  .action(async (options: any) => {
    const current = await getWebhookConfig();
    const updated = {
      delayMs: options.delay ? Number(options.delay) : current.delayMs,
      retryCount: options.retry ? Number(options.retry) : current.retryCount,
      retryDelayMs: options.retryDelay ? Number(options.retryDelay) : current.retryDelayMs,
      duplicate: typeof options.duplicate === "boolean" ? options.duplicate : current.duplicate,
      drop: typeof options.drop === "boolean" ? options.drop : current.drop
    };

    await setWebhookConfig(updated);
    console.log(chalk.green("Webhook config updated"));
    console.log(updated);
  });

program
  .command("reset")
  .description("Clear ChronoDB data")
  .action(async () => {
    const { transactions, transfers, webhooks, settings, logs } = await getCollections();
    await transactions.deleteAll();
    await transfers.deleteAll();
    await webhooks.deleteAll();
    await settings.deleteAll();
    await logs.deleteAll();

    const db = await getDb();
    if (db?.snapshots?.deleteAll) {
      await db.snapshots.deleteAll();
    }

    console.log(chalk.green("Database cleared"));
  });

program
  .command("logs")
  .description("Stream live logs")
  .action(async () => {
    const config = getConfig();
    const url = `http://localhost:${config.paystackPort}/__logs`;
    console.log(chalk.gray(`Streaming logs from ${url}`));

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/event-stream"
        }
      });

      if (!res.body) {
        console.log(chalk.red("No log stream available"));
        return;
      }

      const reader = res.body.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value);
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.replace(/^data:\s*/, "");
          try {
            const entry = JSON.parse(payload) as { level: string; message: string; timestamp: number; source?: string };
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const prefix = entry.source ? `[${entry.source}] ` : "";
            console.log(`${chalk.gray(time)} ${prefix}${entry.message}`);
          } catch {
            // ignore parse issues
          }
        }
      }
    } catch {
      console.log(chalk.red("Unable to connect to log stream. Is mockpay running?"));
    }
  });

program.parseAsync(process.argv);
