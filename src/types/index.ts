export interface TransactionRecord {
  id?: string;
  provider: "paystack" | "flutterwave";
  reference: string;
  status: string;
  amount: number;
  currency: string;
  customerEmail: string;
  callbackUrl?: string | null;
  metadata?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface TransferRecord {
  id?: string;
  provider: "paystack" | "flutterwave";
  reference: string;
  status: string;
  amount: number;
  currency: string;
  bankCode?: string | null;
  accountNumber?: string | null;
  narration?: string | null;
  metadata?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface WebhookRecord {
  id?: string;
  provider: "paystack" | "flutterwave";
  event: string;
  url: string;
  status: "pending" | "sent" | "failed" | "dropped";
  attempts: number;
  payload: string;
  lastAttemptAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface SettingEntry {
  id?: string;
  key: string;
  value: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface LogEntry {
  id?: string;
  level: "info" | "warn" | "error" | "http";
  message: string;
  source?: string;
  timestamp: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface PaymentProvider {
  registerRoutes(app: import("express").Express): void;
}
