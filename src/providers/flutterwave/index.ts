import type { Express, Request, Response } from "express";

import { getCollections } from "../../core/db";
import { getConfig } from "../../core/config";
import { generateReference } from "../../core/utils";
import { takeNextPaymentResult } from "../../core/state";
import { logger } from "../../core/logger";
import { sendWebhook } from "../../webhooks/sender";
import type { PaymentProvider, TransactionRecord } from "../../types/index";

export class FlutterwaveProvider implements PaymentProvider {
  registerRoutes(app: Express): void {
    app.post("/payments", this.initialize);
    app.post("/transfers", this.createTransfer);
  }

  private initialize = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const { defaultWebhookUrl } = getConfig();
    const reference = generateReference("FLW");
    const amount = Number(req.body?.amount ?? 0);
    const email = String(req.body?.customer?.email ?? "customer@example.com");
    const callbackUrl = req.body?.redirect_url || defaultWebhookUrl || null;

    const record: TransactionRecord = {
      provider: "flutterwave",
      reference,
      status: "pending",
      amount,
      currency: String(req.body?.currency ?? "NGN"),
      customerEmail: email,
      callbackUrl,
      metadata: JSON.stringify(req.body?.meta ?? null)
    };

    const saved = await transactions.add(record);

    res.json({
      status: "success",
      message: "Hosted Link created",
      data: {
        link: `http://localhost:5173/checkout?ref=${reference}`,
        tx_ref: reference
      }
    });

    const result = await takeNextPaymentResult();
    const status = result === "success" ? "successful" : result === "failed" ? "failed" : "cancelled";
    await transactions.updateById(saved.id, { status });

    if (callbackUrl) {
      const event = status === "successful" ? "charge.completed" : "charge.failed";
      void sendWebhook({
        provider: "flutterwave",
        event,
        url: callbackUrl,
        payload: {
          event,
          data: {
            id: saved.id,
            tx_ref: saved.reference,
            status,
            amount: saved.amount,
            currency: saved.currency,
            customer: {
              email: saved.customerEmail
            }
          }
        }
      });
    } else {
      logger.warn("No callback URL provided for Flutterwave webhook", "flutterwave");
    }
  };

  private createTransfer = async (req: Request, res: Response) => {
    const { transfers } = await getCollections();
    const reference = generateReference("FLT");
    const amount = Number(req.body?.amount ?? 0);

    const transfer = await transfers.add({
      provider: "flutterwave",
      reference,
      status: "pending",
      amount,
      currency: String(req.body?.currency ?? "NGN"),
      bankCode: req.body?.bank_code ?? null,
      accountNumber: req.body?.account_number ?? null,
      narration: req.body?.narration ?? null,
      metadata: JSON.stringify(req.body?.meta ?? null)
    });

    res.json({
      status: "success",
      message: "Transfer queued",
      data: {
        id: transfer.id,
        reference: transfer.reference,
        status: transfer.status,
        amount: transfer.amount,
        currency: transfer.currency
      }
    });
  };
}