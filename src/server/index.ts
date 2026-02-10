import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { getConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { getCollections } from "../core/db.js";
import { PaystackProvider } from "../providers/paystack/index.js";
import { FlutterwaveProvider } from "../providers/flutterwave/index.js";
import { requestLogger } from "./middleware/logging.js";
import { errorSimulation } from "./middleware/errorSimulation.js";
import { logsRoute } from "../routes/logs.js";

async function start() {
  const config = getConfig();
  await getCollections();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const packageRoot = path.resolve(__dirname, "..", "..");
  const frontendDist = path.resolve(packageRoot, "template", "dist");

  const serveFrontend = (_req: express.Request, res: express.Response) => {
    const indexPath = path.join(frontendDist, "index.html");
    if (!fs.existsSync(indexPath)) {
      res.status(503).json({
        status: "missing_frontend",
        message: "Checkout UI not built. Run: pnpm --prefix template run build"
      });
      return;
    }
    res.sendFile(indexPath);
  };

  const paystackApp = express();
  paystackApp.use(express.json());
  paystackApp.use(requestLogger("paystack"));
  paystackApp.use(errorSimulation);
  paystackApp.get("/__logs", logsRoute);
  paystackApp.get("/__health", (_req, res) => res.json({ status: "ok", provider: "paystack" }));
  paystackApp.use(express.static(frontendDist));
  paystackApp.get(["/", "/checkout", "/success", "/failed", "/cancelled"], serveFrontend);

  new PaystackProvider().registerRoutes(paystackApp);

  paystackApp.listen(config.paystackPort, () => {
    logger.info(`Paystack mock listening on http://localhost:${config.paystackPort}`, "server");
  });

  const flutterwaveApp = express();
  flutterwaveApp.use(express.json());
  flutterwaveApp.use(requestLogger("flutterwave"));
  flutterwaveApp.use(errorSimulation);
  flutterwaveApp.get("/__logs", logsRoute);
  flutterwaveApp.get("/__health", (_req, res) => res.json({ status: "ok", provider: "flutterwave" }));
  flutterwaveApp.use(express.static(frontendDist));
  flutterwaveApp.get(["/", "/checkout", "/success", "/failed", "/cancelled"], serveFrontend);

  new FlutterwaveProvider().registerRoutes(flutterwaveApp);

  flutterwaveApp.listen(config.flutterwavePort, () => {
    logger.info(`Flutterwave mock listening on http://localhost:${config.flutterwavePort}`, "server");
  });
}

start().catch((err) => {
  logger.error(`Failed to start servers: ${err?.message ?? err}`, "server");
  process.exit(1);
});
