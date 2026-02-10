import React from 'react';
import { HiCreditCard, HiLibrary, HiSwitchHorizontal, HiDeviceMobile } from 'react-icons/hi';
import { PaymentMethod } from '../types';

interface PaymentMethodIconProps {
  method: PaymentMethod;
  isActive: boolean;
  onClick: () => void;
  label: string;
}

const PaymentMethodIcon: React.FC<PaymentMethodIconProps> = ({ method, isActive, onClick, label }) => {
  const getIcon = () => {
    switch (method) {
      case PaymentMethod.CARD: return <HiCreditCard size={26} />;
      case PaymentMethod.BANK: return <HiLibrary size={26} />;
      case PaymentMethod.TRANSFER: return <HiSwitchHorizontal size={26} />;
      case PaymentMethod.USSD: return <HiDeviceMobile size={26} />;
    }
  };

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-5 rounded-[1.5rem] border transition-all duration-300 w-full space-y-3 group
        ${isActive 
          ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm ring-1 ring-indigo-200' 
          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}
    >
      <div className={`transition-transform duration-300 ${isActive ? 'scale-110 text-indigo-600' : 'group-hover:scale-105 text-slate-400'}`}>
        {getIcon()}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
        {label}
      </span>
    </button>
  );
};

export default PaymentMethodIcon;
