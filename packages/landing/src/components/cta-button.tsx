'use client';

import { cn } from '@/lib/utils';

interface CTAButtonProps {
  variant: 'warm' | 'navy';
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
}

export function CTAButton({
  variant,
  children,
  onClick,
  type = 'button',
  className,
  disabled,
}: CTAButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-8 py-4 text-lg font-semibold transition-all duration-200',
        'min-h-[44px] min-w-[44px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'warm' && [
          'bg-forest-600 text-white hover:bg-forest-700',
          'focus-visible:ring-forest-500',
          'shadow-lg hover:shadow-xl',
        ],
        variant === 'navy' && [
          'bg-navy-accent text-white hover:bg-blue-500',
          'focus-visible:ring-navy-accent',
          'shadow-lg hover:shadow-xl',
        ],
        className
      )}
    >
      {children}
    </button>
  );
}
