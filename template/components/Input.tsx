import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            {icon}
          </div>
        )}
        <input 
          className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 ${icon ? 'pl-11' : ''} text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${className}`}
          {...props}
        />
      </div>
    </div>
  );
};

export default Input;
