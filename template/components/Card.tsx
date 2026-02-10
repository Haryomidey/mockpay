import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-[2.5rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100 w-full max-w-[440px] animate-scale-in relative ${className}`}>
      {children}
    </div>
  );
};

export default Card;