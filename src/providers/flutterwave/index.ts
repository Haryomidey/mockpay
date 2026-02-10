import type { Express, Request, Response } from "express";

import { getCollections } from "../../core/db.js";
import { getConfig } from "../../core/config.js";
import { generateReference } from "../../core/utils.js";
import { logger } from "../../core/logger.js";
import { sendWebhook } from "../../webhooks/sender.js";
import type { PaymentProvider, TransactionRecord } from "../../types/index.js";

type CheckoutStatus = "success" | "failed" | "cancelled";

function mapCheckoutStatusToFlutterwave(status: CheckoutStatus): "successful" | "failed" | "cancelled" {
  if (status === "success") return "successful";
  if (status === "failed") return "failed";
  return "cancelled";
}

function webhookEventFromStatus(status: string): string {
  if (status === "successful") return "charge.completed";
  if (status === "cancelled") return "charge.cancelled";
  return "charge.failed";
}

function buildVerifyResponse(transaction: any) {
  return {
    id: transaction.id,
    tx_ref: transaction.reference,
    flw_ref: `FLW-MOCK-${transaction.reference}`,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    customer: {
      email: transaction.customerEmail,
      name: transaction.customerName
    }
  };
}

export class FlutterwaveProvider implements PaymentProvider {
  registerRoutes(app: Express): void {
    app.post("/payments", this.initialize);
    app.post("/mock/complete", this.completeCheckout);
    app.get("/transactions/verify_by_reference", this.verifyByReference);
    app.get("/transactions/:id/verify", this.verifyById);
    app.post("/transfers", this.createTransfer);
  }

  private initialize = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const { defaultWebhookUrl, frontendUrl, flutterwavePort } = getConfig();
    const reference = generateReference("FLW");
    const amount = Number(req.body?.amount ?? 0);
    const email = String(req.body?.customer?.email ?? "customer@example.com");
    const name = req.body?.customer?.name ? String(req.body?.customer?.name) : null;
    const currency = String(req.body?.currency ?? "NGN").toUpperCase();
    const callbackUrl = req.body?.redirect_url || defaultWebhookUrl || null;

    const record: TransactionRecord = {
      provider: "flutterwave",
      reference,
      status: "pending",
      amount,
      currency,
      customerEmail: email,
      customerName: name,
      callbackUrl,
      metadata: JSON.stringify(req.body?.meta ?? null)
    };

    await transactions.add(record);

    const checkoutBase = frontendUrl ?? `http://localhost:${flutterwavePort}`;
    const checkoutUrl = new URL("/checkout", checkoutBase);
    checkoutUrl.searchParams.set("provider", "flutterwave");
    checkoutUrl.searchParams.set("ref", reference);
    checkoutUrl.searchParams.set("amount", String(amount));
    checkoutUrl.searchParams.set("currency", currency);
    checkoutUrl.searchParams.set("email", email);
    if (name) checkoutUrl.searchParams.set("name", name);
    if (callbackUrl) checkoutUrl.searchParams.set("redirect_url", callbackUrl);

    res.json({
      status: "success",
      message: "Hosted Link created",
      data: {
        link: checkoutUrl.toString(),
        tx_ref: reference
      }
    });
  };

  private completeCheckout = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const reference = String(req.body?.reference ?? "");
    const checkoutStatus = String(req.body?.status ?? "") as CheckoutStatus;

    if (!reference) {
      res.status(400).json({ status: "error", message: "reference is required" });
      return;
    }

    if (!["success", "failed", "cancelled"].includes(checkoutStatus)) {
      res.status(400).json({ status: "error", message: "status must be success|failed|cancelled" });
      return;
    }

    const transaction = await transactions.getOne({ reference, provider: "flutterwave" });
    if (!transaction) {
      res.status(404).json({ status: "error", message: "Transaction not found" });
      return;
    }

    const finalStatus = mapCheckoutStatusToFlutterwave(checkoutStatus);
    await transactions.updateById(transaction.id, { status: finalStatus });
    transaction.status = finalStatus;

    if (transaction.callbackUrl) {
      const event = webhookEventFromStatus(finalStatus);
      void sendWebhook({
        provider: "flutterwave",
        event,
        url: transaction.callbackUrl,
        payload: {
          event,
          data: {
            id: transaction.id,
            tx_ref: transaction.reference,
            status: finalStatus,
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
      logger.warn("No callback URL provided for Flutterwave webhook", "flutterwave");
    }

    res.json({
      status: "success",
      message: "Checkout status captured",
      data: {
        transaction_id: transaction.id,
        tx_ref: reference,
        status: finalStatus
      }
    });
  };

  private verifyByReference = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const txRef = String(req.query?.tx_ref ?? "");

    if (!txRef) {
      res.status(400).json({ status: "error", message: "tx_ref query parameter is required" });
      return;
    }

    const transaction = await transactions.getOne({ reference: txRef, provider: "flutterwave" });
    if (!transaction) {
      res.status(404).json({ status: "error", message: "Transaction not found" });
      return;
    }

    res.json({
      status: "success",
      message: "Transaction fetched successfully",
      data: buildVerifyResponse(transaction)
    });
  };

  private verifyById = async (req: Request, res: Response) => {
    const { transactions } = await getCollections();
    const id = String(req.params.id ?? "");
    const transaction = await transactions.getById(id);

    if (!transaction || transaction.provider !== "flutterwave") {
      res.status(404).json({ status: "error", message: "Transaction not found" });
      return;
    }

    res.json({
      status: "success",
      message: "Transaction fetched successfully",
      data: buildVerifyResponse(transaction)
    });
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