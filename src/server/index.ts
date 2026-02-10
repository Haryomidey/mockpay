import express from "express";

import { getConfig } from "../core/config";
import { logger } from "../core/logger";
import { PaystackProvider } from "../providers/paystack/index";
import { FlutterwaveProvider } from "../providers/flutterwave/index";
import { requestLogger } from "./middleware/logging";
import { errorSimulation } from "./middleware/errorSimulation";
import { logsRoute } from "../routes/logs";

async function start() {
  const config = getConfig();

  const paystackApp = express();
  paystackApp.use(express.json());
  paystackApp.use(requestLogger("paystack"));
  paystackApp.use(errorSimulation);
  paystackApp.get("/__logs", logsRoute);
  paystackApp.get("/", (_req, res) => res.json({ status: "ok", provider: "paystack" }));

  new PaystackProvider().registerRoutes(paystackApp);

  paystackApp.listen(config.paystackPort, () => {
    logger.info(`Paystack mock listening on http://localhost:${config.paystackPort}`, "server");
  });

  const flutterwaveApp = express();
  flutterwaveApp.use(express.json());
  flutterwaveApp.use(requestLogger("flutterwave"));
  flutterwaveApp.use(errorSimulation);
  flutterwaveApp.get("/__logs", logsRoute);
  flutterwaveApp.get("/", (_req, res) => res.json({ status: "ok", provider: "flutterwave" }));

  new FlutterwaveProvider().registerRoutes(flutterwaveApp);

  flutterwaveApp.listen(config.flutterwavePort, () => {
    logger.info(`Flutterwave mock listening on http://localhost:${config.flutterwavePort}`, "server");
  });
}

start().catch((err) => {
  logger.error(`Failed to start servers: ${err?.message ?? err}`, "server");
  process.exit(1);
});
