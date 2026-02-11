import React from 'react';
import StatusScreen from '../components/StatusScreen';
import { useQueryParams } from '../hooks/useQueryParams';

const FailedPage: React.FC = () => {
  const { ref, provider, callbackUrl, transactionId } = useQueryParams();
  return (
    <StatusScreen 
      status="failed"
      title="Payment Failed"
      message="We couldn't process your transaction at this time. Please check your card details and try again."
      reference={ref}
      provider={provider}
      callbackUrl={callbackUrl}
      transactionId={transactionId}
    />
  );
};

export default FailedPage;
