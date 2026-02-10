export type PaymentStatus = 'success' | 'failed' | 'cancelled';

export interface CheckoutParams {
  provider: 'paystack' | 'flutterwave';
  ref: string;
  amount: string;
  currency: string;
  email: string;
  name: string;
  callbackUrl?: string;
}

export interface PaymentRequest {
  reference: string;
  status: PaymentStatus;
}

export enum PaymentMethod {
  CARD = 'card',
  BANK = 'bank',
  TRANSFER = 'transfer',
  USSD = 'ussd'
}
