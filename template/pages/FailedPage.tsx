import React from 'react';
import StatusScreen from '../components/StatusScreen';
import { useQueryParams } from '../hooks/useQueryParams';

const FailedPage: React.FC = () => {
  const { ref } = useQueryParams();
  return (
    <StatusScreen 
      status="failed"
      title="Payment Failed"
      message="We couldn't process your transaction at this time. Please check your card details and try again."
      reference={ref}
    />
  );
};

export default FailedPage;