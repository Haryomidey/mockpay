import crypto from "crypto";

export function generateReference(prefix: string): string {
  const random = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${Date.now()}_${random}`;
}

export function toKobo(amount: number): number {
  return Math.round(amount * 100);
}
