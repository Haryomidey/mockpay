import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryParams } from '../hooks/useQueryParams';
import { PaymentMethod, PaymentStatus } from '../types';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import PaymentMethodIcon from '../components/PaymentMethodIcon';
import { 
  HiCreditCard, 
  HiCalendar, 
  HiLockClosed, 
  HiArrowLeft, 
  HiDuplicate,
  HiCheck,
  HiChevronRight,
  HiCurrencyDollar
} from 'react-icons/hi';

const MOCK_BANKS = [
  { id: '1', name: 'Access Bank', code: '044' },
  { id: '2', name: 'GTBank', code: '058' },
  { id: '3', name: 'Zenith Bank', code: '057' },
  { id: '4', name: 'Kuda Bank', code: '090' },
];

function resolveFinalStatus(
  provider: 'paystack' | 'flutterwave',
  requestedStatus: PaymentStatus,
  completionPayload: any
): PaymentStatus {
  const checkoutStatus = String(completionPayload?.data?.checkout_status ?? '').toLowerCase();
  if (checkoutStatus === 'success' || checkoutStatus === 'failed' || checkoutStatus === 'cancelled') {
    return checkoutStatus as PaymentStatus;
  }

  const rawStatus = String(completionPayload?.data?.status ?? '').toLowerCase();

  if (!rawStatus) {
    return requestedStatus;
  }

  if (provider === 'paystack') {
    if (rawStatus === 'success') return 'success';
    if (rawStatus === 'failed') return 'failed';
    if (rawStatus === 'abandoned') return 'cancelled';
  }

  if (provider === 'flutterwave') {
    if (rawStatus === 'successful') return 'success';
    if (rawStatus === 'failed') return 'failed';
    if (rawStatus === 'cancelled') return 'cancelled';
  }

  return requestedStatus;
}

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { provider, ref, amount, currency, email, name, callbackUrl, apiBase } = useQueryParams();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.CARD);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [copied, setCopied] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(parseFloat(amount) || 0);

  const handlePayment = async (status: PaymentStatus) => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    let completionPayload: any = null;
    const fallbackApiBase = provider === 'paystack' ? 'http://localhost:4010' : 'http://localhost:4020';
    const completionUrl = new URL('/mock/complete', apiBase ?? fallbackApiBase).toString();
    try {
      const response = await fetch(completionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, reference: ref, status }),
      });
      completionPayload = await response.json().catch(() => null);
    } catch (error) {
      console.warn('Mock server unavailable, continuing with UI flow.');
    } finally {
      setIsProcessing(false);
      const finalStatus = resolveFinalStatus(provider, status, completionPayload);
      const params = new URLSearchParams();
      params.set('ref', ref);
      params.set('provider', provider);
      if (callbackUrl) params.set('callback_url', callbackUrl);
      if (provider === 'flutterwave' && completionPayload?.data?.transaction_id) {
        params.set('transaction_id', String(completionPayload.data.transaction_id));
      }
      navigate(`/${finalStatus}?${params.toString()}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 19);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const formatCvv = (value: string) => value.replace(/\D/g, '').slice(0, 4);

  const renderCardFlow = () => (
    <div className="space-y-6 animate-scale-in">
      <div className="space-y-4">
        <Input 
          label="Card Number" 
          placeholder="0000 0000 0000 0000" 
          icon={<HiCreditCard size={20} />} 
          inputMode="numeric"
          autoComplete="cc-number"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          maxLength={23}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Expiry Date" 
            placeholder="MM / YY" 
            icon={<HiCalendar size={20} />} 
            inputMode="numeric"
            autoComplete="cc-exp"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
            maxLength={5}
          />
          <Input 
            label="CVV" 
            placeholder="123" 
            type="password"
            icon={<HiLockClosed size={20} />} 
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cardCvv}
            onChange={(e) => setCardCvv(formatCvv(e.target.value))}
            maxLength={4}
          />
        </div>
      </div>
      <div className="pt-2 space-y-3">
        <Button isLoading={isProcessing} onClick={() => handlePayment('success')}>
          Pay {formattedAmount}
        </Button>
        <Button variant="ghost" onClick={() => handlePayment('failed')}>
          Simulate Failed Payment
        </Button>
      </div>
    </div>
  );

  const renderTransferFlow = () => (
    <div className="space-y-6 animate-scale-in">
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Transfer to the account below</p>
        
        <div className="space-y-1 mb-6">
          <p className="text-sm font-medium text-slate-500">Bank Name</p>
          <p className="text-xl font-bold text-slate-800">MockPay Savings Bank</p>
        </div>

        <div className="space-y-1 mb-6">
          <p className="text-sm font-medium text-slate-500">Account Number</p>
          <div className="flex items-center justify-center space-x-2">
            <p className="text-3xl font-black text-indigo-600 tracking-tighter">0123456789</p>
            <button 
              onClick={() => copyToClipboard('0123456789')}
              className="p-2 hover:bg-indigo-100 rounded-full transition-colors text-indigo-600"
            >
              {copied ? <HiCheck size={20} /> : <HiDuplicate size={20} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">Account Name</p>
          <p className="text-md font-semibold text-slate-700 uppercase">MOCKSTORE INC - CHECKOUT</p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-[11px] text-amber-700 leading-tight">
          Please complete this transfer within 30 minutes. Your payment will be confirmed automatically once the transfer is detected.
        </p>
      </div>

      <div className="pt-2 space-y-3">
        <Button isLoading={isProcessing} onClick={() => handlePayment('success')}>
          I've Sent the Money
        </Button>
      </div>
    </div>
  );

  const renderBankFlow = () => (
    <div className="space-y-6 animate-scale-in">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select your Bank</p>
      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
        {MOCK_BANKS.map((bank) => (
          <button
            key={bank.id}
            onClick={() => setSelectedBank(bank.id)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              selectedBank === bank.id 
                ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' 
                : 'bg-white border-slate-100 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xs text-slate-500">
                {bank.name.charAt(0)}
              </div>
              <span className="font-semibold text-slate-700">{bank.name}</span>
            </div>
            <HiChevronRight className={selectedBank === bank.id ? 'text-indigo-500' : 'text-slate-300'} />
          </button>
        ))}
      </div>
      <Button 
        disabled={!selectedBank} 
        isLoading={isProcessing} 
        onClick={() => handlePayment('success')}
      >
        Authenticate with Bank
      </Button>
    </div>
  );

  const renderUSSDFlow = () => (
    <div className="space-y-6 animate-scale-in">
      <div className="bg-slate-900 text-white rounded-2xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Dial code below on your phone</p>
        <p className="text-3xl font-mono font-black tracking-widest mb-2 text-indigo-400">
          *737*000*821#
        </p>
        <p className="text-sm text-slate-400">Code expires in <span className="text-white font-mono">04:59</span></p>
      </div>
      
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-500 text-center">
          Wait for the USSD prompt on your mobile device and authorize with your PIN.
        </p>
        <Button isLoading={isProcessing} onClick={() => handlePayment('success')}>
          I've Completed the Dial
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      {/* Test Mode Ribbon */}
      <div className="absolute -left-12 top-6 -rotate-45 bg-amber-400 text-amber-900 text-[10px] font-black py-1 px-12 shadow-sm z-10 uppercase tracking-tighter">
        Test Mode
      </div>

      {/* Header */}
      <div className="bg-[#3F51B5] px-8 pt-12 pb-10 text-white relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex items-center space-x-2">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20">
              <HiCurrencyDollar size={20} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">MockStore Inc.</span>
          </div>
          <button 
            onClick={() => handlePayment('cancelled')}
            className="text-white/60 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            Cancel
          </button>
        </div>
        
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Paying Amount</p>
          <h1 className="text-4xl font-extrabold tracking-tight">{formattedAmount}</h1>
          <p className="text-indigo-200 text-sm mt-2 opacity-80">{name} · {email}</p>
        </div>
      </div>

      <div className="p-8">
        {/* Step Indicator */}
        <div className="flex items-center space-x-2 mb-8">
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${activeStep >= 1 ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${activeStep >= 2 ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
        </div>

        {activeStep === 1 ? (
          <div className="space-y-6 animate-scale-in">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">How would you like to pay?</p>
              <div className="grid grid-cols-2 gap-3">
                <PaymentMethodIcon 
                  method={PaymentMethod.CARD} 
                  label="Card" 
                  isActive={selectedMethod === PaymentMethod.CARD} 
                  onClick={() => setSelectedMethod(PaymentMethod.CARD)}
                />
                <PaymentMethodIcon 
                  method={PaymentMethod.TRANSFER} 
                  label="Transfer" 
                  isActive={selectedMethod === PaymentMethod.TRANSFER} 
                  onClick={() => setSelectedMethod(PaymentMethod.TRANSFER)}
                />
                <PaymentMethodIcon 
                  method={PaymentMethod.BANK} 
                  label="Bank" 
                  isActive={selectedMethod === PaymentMethod.BANK} 
                  onClick={() => setSelectedMethod(PaymentMethod.BANK)}
                />
                <PaymentMethodIcon 
                  method={PaymentMethod.USSD} 
                  label="USSD" 
                  isActive={selectedMethod === PaymentMethod.USSD} 
                  onClick={() => setSelectedMethod(PaymentMethod.USSD)}
                />
              </div>
            </div>

            <Button onClick={() => setActiveStep(2)}>
              Pay with {selectedMethod === PaymentMethod.USSD ? 'USSD' : selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1)}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <button 
              onClick={() => setActiveStep(1)}
              className="flex items-center text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
            >
              <HiArrowLeft className="mr-1" /> Change Payment Method
            </button>

            {selectedMethod === PaymentMethod.CARD && renderCardFlow()}
            {selectedMethod === PaymentMethod.TRANSFER && renderTransferFlow()}
            {selectedMethod === PaymentMethod.BANK && renderBankFlow()}
            {selectedMethod === PaymentMethod.USSD && renderUSSDFlow()}
            
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] pt-4">
              Secure Checkout by <span className="text-indigo-500">MockPay</span>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CheckoutPage;
