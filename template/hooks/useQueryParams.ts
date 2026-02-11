import { useLocation } from 'react-router-dom';
import { CheckoutParams } from '../types';

export const useQueryParams = (): CheckoutParams => {
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const provider = query.get('provider');
  const callbackUrl = query.get('callback_url') || query.get('redirect_url') || undefined;

  return {
    provider: provider === 'flutterwave' ? 'flutterwave' : 'paystack',
    ref: query.get('ref') || 'N/A',
    amount: query.get('amount') || '0',
    currency: query.get('currency') || 'NGN',
    email: query.get('email') || 'customer@example.com',
    name: query.get('name') || 'Customer',
    callbackUrl,
    transactionId: query.get('transaction_id') || undefined,
  };
};
