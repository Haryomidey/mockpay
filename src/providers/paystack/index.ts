import type { Express, Request, Response } from "express";

import { getCollections } from "../../core/db.js";
import { getConfig } from "../../core/config.js";
import { generateReference } from "../../core/utils";
import { takeNextPaymentResult } from "../../core/state";
import { logger } from "../../core/logger";
import { sendWebhook } from "../../webhooks/sender";
import type { PaymentProvider, TransactionRecord } from "../../types/index";

export class PaystackProvider implements PaymentProvider {
  registerRoutes(app: Express): void {
    app.post("/transaction/initialize", this.initialize);
    app.post("/transaction/verify/:reference", this.verify);
    app.post("/transfer", this.createTransfer);
    app.get("/banks", this.getBanks);
  }

  private initialize = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const { defaultWebhookUrl, frontendUrl } = getConfig();
    const reference = generateReference("PSK");
    const amount = Number(req.body?.amount ?? 0);
    const email = String(req.body?.email ?? "customer@example.com");
    const callbackUrl = req.body?.callback_url || defaultWebhookUrl || null;

    const record: TransactionRecord = {
      provider: "paystack",
      reference,
      status: "pending",
      amount,
      currency: "NGN",
      customerEmail: email,
      callbackUrl,
      metadata: JSON.stringify(req.body?.metadata ?? null)
    };

    await transactions.add(record);

    res.json({
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: `${frontendUrl}/checkout?ref=${reference}`,
        access_code: generateReference("AC"),
        reference
      }
    });
  };

  private verify = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const reference = String(req.params.reference);
    const transaction = await transactions.getOne({ reference });

    if (!transaction) {
      res.status(404).json({ status: false, message: "Transaction not found" });
      return;
    }

    if (transaction.status === "pending") {
      const result = await takeNextPaymentResult();
      const status = result === "success" ? "success" : result === "failed" ? "failed" : "abandoned";
      await transactions.updateById(transaction.id, { status });
      transaction.status = status;

      if (transaction.callbackUrl) {
        const event =
          status === "success"
            ? "charge.success"
            : status === "failed"
            ? "charge.failed"
            : "charge.abandoned";

        void sendWebhook({
          provider: "paystack",
          event,
          url: transaction.callbackUrl,
          payload: {
            event,
            data: {
              reference: transaction.reference,
              status,
              amount: transaction.amount,
              currency: transaction.currency,
              customer: {
                email: transaction.customerEmail
              }
            }
          }
        });
      } else {
        logger.warn("No callback URL provided for Paystack webhook", "paystack");
      }
    }

    res.json({
      status: true,
      message: "Verification successful",
      data: {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        transaction_date: new Date().toISOString(),
        status: transaction.status,
        reference: transaction.reference,
        gateway_response: transaction.status === "success" ? "Approved" : "Declined",
        customer: {
          email: transaction.customerEmail
        }
      }
    });
  };

  private createTransfer = async (req: Request, res: Response) => {
    const { transfers } = await getCollections();
    const reference = generateReference("PST");
    const amount = Number(req.body?.amount ?? 0);

    const transfer = await transfers.add({
      provider: "paystack",
      reference,
      status: "pending",
      amount,
      currency: "NGN",
      bankCode: req.body?.bank_code ?? null,
      accountNumber: req.body?.account_number ?? null,
      narration: req.body?.reason ?? null,
      metadata: JSON.stringify(req.body?.metadata ?? null)
    });

    res.json({
      status: true,
      message: "Transfer queued",
      data: {
        id: transfer.id,
        transfer_code: generateReference("TRF"),
        reference: transfer.reference,
        status: transfer.status,
        amount: transfer.amount,
        currency: transfer.currency
      }
    });
  };

  private getBanks = (_req: Request, res: Response) => {
    res.json({
      status: true,
      message: "Banks retrieved",
      data: [
        { name: "Access Bank", code: "044" },
        { name: "GTBank", code: "058" },
        { name: "Kuda Bank", code: "50211" },
        { name: "Zenith Bank", code: "057" }
      ]
    });
  };
}


