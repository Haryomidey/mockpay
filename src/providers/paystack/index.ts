import type { Express, Request, Response } from "express";

import { getCollections } from "../../core/db.js";
import { getConfig } from "../../core/config.js";
import { generateReference } from "../../core/utils.js";
import { takeNextPaymentResult } from "../../core/state.js";
import { logger } from "../../core/logger.js";
import { sendWebhook } from "../../webhooks/sender.js";
import type { PaymentProvider, TransactionRecord } from "../../types/index.js";

type CheckoutStatus = "success" | "failed" | "cancelled";
type FinalPaystackStatus = "success" | "failed" | "abandoned";

function mapCheckoutStatusToPaystack(status: CheckoutStatus): "success" | "failed" | "abandoned" {
  if (status === "success") return "success";
  if (status === "failed") return "failed";
  return "abandoned";
}

function mapCliStatusToPaystack(status: "success" | "failed" | "cancelled"): FinalPaystackStatus {
  if (status === "success") return "success";
  if (status === "failed") return "failed";
  return "abandoned";
}

function gatewayResponse(status: string): string {
  if (status === "success") return "Approved";
  if (status === "abandoned") return "Abandoned";
  return "Declined";
}

export class PaystackProvider implements PaymentProvider {
  registerRoutes(app: Express): void {
    app.post("/transaction/initialize", this.initialize);
    app.get("/transaction/verify/:reference", this.verify);
    app.post("/transaction/verify/:reference", this.verify);
    app.post("/mock/complete", this.completeCheckout);
    app.post("/transfer", this.createTransfer);
    app.get("/banks", this.getBanks);
  }

  private initialize = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const { defaultWebhookUrl, frontendUrl, paystackPort } = getConfig();
    const reference = generateReference("PSK");
    const amount = Number(req.body?.amount ?? 0);
    const email = String(req.body?.email ?? req.body?.customer?.email ?? "customer@example.com");
    const name = req.body?.name
      ? String(req.body?.name)
      : req.body?.customer?.name
      ? String(req.body?.customer?.name)
      : null;
    const currency = String(req.body?.currency ?? "NGN").toUpperCase();
    const callbackUrl = req.body?.callback_url || defaultWebhookUrl || null;

    const record: TransactionRecord = {
      provider: "paystack",
      reference,
      status: "pending",
      amount,
      currency,
      customerEmail: email,
      customerName: name,
      callbackUrl,
      metadata: JSON.stringify(req.body?.metadata ?? null)
    };

    await transactions.add(record);

    const checkoutBase = frontendUrl ?? `http://localhost:${paystackPort}`;
    const checkoutUrl = new URL("/checkout", checkoutBase);
    checkoutUrl.searchParams.set("provider", "paystack");
    checkoutUrl.searchParams.set("ref", reference);
    checkoutUrl.searchParams.set("amount", String(amount));
    checkoutUrl.searchParams.set("currency", currency);
    checkoutUrl.searchParams.set("email", email);
    if (name) checkoutUrl.searchParams.set("name", name);
    if (callbackUrl) checkoutUrl.searchParams.set("callback_url", callbackUrl);

    res.json({
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: checkoutUrl.toString(),
        access_code: generateReference("AC"),
        reference
      }
    });
  };

  private completeCheckout = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const reference = String(req.body?.reference ?? "");
    const checkoutStatus = String(req.body?.status ?? "") as CheckoutStatus;

    if (!reference) {
      res.status(400).json({ status: false, message: "reference is required" });
      return;
    }

    if (!["success", "failed", "cancelled"].includes(checkoutStatus)) {
      res.status(400).json({ status: false, message: "status must be success|failed|cancelled" });
      return;
    }

    const transaction = await transactions.getOne({ reference, provider: "paystack" });
    if (!transaction) {
      res.status(404).json({ status: false, message: "Transaction not found" });
      return;
    }

    // CLI-driven result takes precedence over checkout input when configured.
    const nextCliStatus = await takeNextPaymentResult();
    const finalStatus =
      nextCliStatus === "success"
        ? mapCheckoutStatusToPaystack(checkoutStatus)
        : mapCliStatusToPaystack(nextCliStatus);
    await transactions.updateById(transaction.id, { status: finalStatus });

    res.json({
      status: true,
      message: "Checkout status captured",
      data: {
        reference,
        status: finalStatus
      }
    });
  };

  private verify = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const reference = String(req.params.reference);
    const transaction = await transactions.getOne({ reference, provider: "paystack" });

    if (!transaction) {
      res.status(404).json({ status: false, message: "Transaction not found" });
      return;
    }

    if (transaction.status === "pending") {
      const result = await takeNextPaymentResult();
      const status = result === "success" ? "success" : result === "failed" ? "failed" : "abandoned";
      await transactions.updateById(transaction.id, { status });
      transaction.status = status;
    }

    if (transaction.callbackUrl) {
      const event =
        transaction.status === "success"
          ? "charge.success"
          : transaction.status === "failed"
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
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
            customer: {
              email: transaction.customerEmail,
              name: transaction.customerName
            }
          }
        }
      });
    } else {
      logger.warn("No callback URL provided for Paystack webhook", "paystack");
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
        gateway_response: gatewayResponse(transaction.status),
        customer: {
          email: transaction.customerEmail,
          name: transaction.customerName
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
