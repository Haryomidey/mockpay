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

function getPackageRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

function getTemplateDistIndexPath(): string {
  return path.resolve(getPackageRoot(), "template", "dist", "index.html");
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function ensureHostedCheckoutBuilt(): Promise<void> {
  const templateIndexPath = getTemplateDistIndexPath();
  if (fs.existsSync(templateIndexPath)) return;

  const packageRoot = getPackageRoot();
  console.log(chalk.yellow("Hosted checkout UI not found. Building it now..."));

  let built = false;

  try {
    await runCommand("npm", ["--prefix", "template", "install"], packageRoot);
    await runCommand("npm", ["--prefix", "template", "run", "build"], packageRoot);
    built = true;
  } catch (npmError: any) {
    console.log(chalk.yellow(`npm build path failed: ${npmError?.message ?? npmError}`));
    console.log(chalk.yellow("Trying pnpm fallback for hosted checkout build..."));
    try {
      await runCommand("pnpm", ["--prefix", "template", "install"], packageRoot);
      await runCommand("pnpm", ["--prefix", "template", "run", "build"], packageRoot);
      built = true;
    } catch (pnpmError: any) {
      throw new Error(
        `Unable to build hosted checkout with npm or pnpm. npm: ${npmError?.message ?? npmError}; pnpm: ${pnpmError?.message ?? pnpmError}`
      );
    }
  }

  if (!built || !fs.existsSync(templateIndexPath)) {
    throw new Error("Hosted checkout build did not produce template/dist/index.html");
  }
}

async function shutdownViaHttp(config: ReturnType<typeof getConfig>): Promise<boolean> {
  const targets = [
    `http://localhost:${config.paystackPort}/__shutdown`,
    `http://localhost:${config.flutterwavePort}/__shutdown`
  ];

  for (const url of targets) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, { method: "POST", signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        return true;
      }
    } catch {
      // ignore and try next endpoint
    }
  }

  return false;
}

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

    try {
      await ensureHostedCheckoutBuilt();
    } catch (error: any) {
      console.log(chalk.red(`Failed to build hosted checkout UI: ${error?.message ?? error}`));
      return;
    }

    const jsServerPath = path.resolve(__dirname, "..", "server", "index.js");
    const tsServerPath = path.resolve(__dirname, "..", "server", "index.ts");
    const serverPath = fs.existsSync(jsServerPath) ? jsServerPath : tsServerPath;
    const child = spawn(process.execPath, [...process.execArgv, serverPath], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        MOCKPAY_DATA_DIR: config.dataDir
      }
    });
    child.unref();

    if (!child.pid) {
      console.log(chalk.red("Failed to start mock servers"));
      return;
    }

    await writeRuntime(child.pid, config.dataDir);
    console.log(chalk.green(`Mockpay started (pid ${child.pid})`));
    console.log(chalk.gray(`Paystack: http://localhost:${config.paystackPort}`));
    console.log(chalk.gray(`Flutterwave: http://localhost:${config.flutterwavePort}`));
  });

program
  .command("stop")
  .description("Stop mock servers")
  .action(async () => {
    const config = getConfig();
    const runtime = await readRuntime();

    if (runtime && isPidRunning(runtime.pid)) {
      try {
        process.kill(runtime.pid);
        await clearRuntime();
        console.log(chalk.green("Mockpay stopped"));
        return;
      } catch {
        // Try graceful HTTP shutdown as fallback.
      }
    }

    const stoppedByHttp = await shutdownViaHttp(config);
    if (stoppedByHttp) {
      await clearRuntime();
      console.log(chalk.green("Mockpay stopped"));
      return;
    }

    console.log(chalk.yellow("Mockpay is not running"));
    await clearRuntime();
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
    const runtime = await readRuntime();
    if (runtime?.dataDir) process.env.MOCKPAY_DATA_DIR = runtime.dataDir;
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
    const runtime = await readRuntime();
    if (runtime?.dataDir) process.env.MOCKPAY_DATA_DIR = runtime.dataDir;
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
    const runtime = await readRuntime();
    if (runtime?.dataDir) process.env.MOCKPAY_DATA_DIR = runtime.dataDir;
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
    const runtime = await readRuntime();
    if (runtime?.dataDir) process.env.MOCKPAY_DATA_DIR = runtime.dataDir;
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
    const runtime = await readRuntime();
    if (runtime?.dataDir) process.env.MOCKPAY_DATA_DIR = runtime.dataDir;
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
    const runtime = await readRuntime();
    if (runtime?.dataDir) process.env.MOCKPAY_DATA_DIR = runtime.dataDir;
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
