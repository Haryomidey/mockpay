
export type PaymentStatus = 'success' | 'failed' | 'cancelled';

export interface CheckoutParams {
  ref: string;
  amount: string;
  email: string;
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
