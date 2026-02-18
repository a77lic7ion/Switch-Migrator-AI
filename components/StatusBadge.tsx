
import React from 'react';

interface BadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info';
}

export const StatusBadge: React.FC<BadgeProps> = ({ label, variant }) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded ${styles[variant]}`}>
      {label}
    </span>
  );
};
