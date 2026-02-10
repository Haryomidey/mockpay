
import React from 'react';
import StatusScreen from '../components/StatusScreen';
import { useQueryParams } from '../hooks/useQueryParams';

const CancelledPage: React.FC = () => {
  const { ref } = useQueryParams();
  return (
    <StatusScreen 
      status="cancelled"
      title="Payment Cancelled"
      message="You have cancelled the payment process. You can return to the merchant site or try again."
      reference={ref}
    />
  );
};

export default CancelledPage;
