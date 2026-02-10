import { useLocation } from 'react-router-dom';
import { CheckoutParams } from '../types';

export const useQueryParams = (): CheckoutParams => {
  const { search } = useLocation();
  const query = new URLSearchParams(search);

  return {
    ref: query.get('ref') || 'N/A',
    amount: query.get('amount') || '0',
    email: query.get('email') || 'customer@example.com',
  };
};