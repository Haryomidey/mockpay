import React from 'react';
import StatusScreen from '../components/StatusScreen';
import { useQueryParams } from '../hooks/useQueryParams';

const SuccessPage: React.FC = () => {
  const { ref } = useQueryParams();
  return (
    <StatusScreen 
      status="success"
      title="Payment Successful"
      message="Your transaction was completed successfully. We've sent a receipt to your email address."
      reference={ref}
    />
  );
};

export default SuccessPage;