import React from 'react';
import { HiCheckCircle, HiXCircle, HiInformationCircle } from 'react-icons/hi';
import Card from './Card';
import Button from './Button';
import { useNavigate } from 'react-router-dom';

interface StatusScreenProps {
  status: 'success' | 'failed' | 'cancelled';
  title: string;
  message: string;
  reference: string;
}

const StatusScreen: React.FC<StatusScreenProps> = ({ status, title, message, reference }) => {
  const navigate = useNavigate();

  const configs = {
    success: {
      icon: <HiCheckCircle className="text-emerald-500 w-24 h-24 drop-shadow-lg" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      btnText: 'Done',
      btnVariant: 'primary' as const
    },
    failed: {
      icon: <HiXCircle className="text-rose-500 w-24 h-24 drop-shadow-lg" />,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      btnText: 'Try Again',
      btnVariant: 'danger' as const
    },
    cancelled: {
      icon: <HiInformationCircle className="text-slate-400 w-24 h-24 drop-shadow-lg" />,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      btnText: 'Back to Checkout',
      btnVariant: 'secondary' as const
    }
  };

  const current = configs[status];

  return (
    <Card>
      <div className="p-8 flex flex-col items-center text-center">
        <div className={`p-4 rounded-full ${current.bgColor} mb-6`}>
          {current.icon}
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${current.color}`}>{title}</h2>
        <p className="text-slate-500 mb-8 max-w-[280px] leading-relaxed">
          {message}
        </p>

        <div className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Payment Reference</p>
          <p className="font-mono text-slate-700 break-all select-all">{reference}</p>
        </div>

        <Button 
          variant={current.btnVariant} 
          onClick={() => status === 'failed' ? navigate(-1) : navigate('/checkout')}
        >
          {current.btnText}
        </Button>
      </div>
    </Card>
  );
};

export default StatusScreen;