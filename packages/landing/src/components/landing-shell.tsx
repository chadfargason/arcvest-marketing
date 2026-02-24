'use client';

import { ComplianceFooter } from './compliance-footer';

interface LandingShellProps {
  variant: 'warm' | 'navy';
  children: React.ReactNode;
  stickyCtaText?: string;
  onStickyCta?: () => void;
}

export function LandingShell({
  variant,
  children,
  stickyCtaText,
  onStickyCta,
}: LandingShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <ComplianceFooter variant={variant} />

      {/* Sticky mobile CTA */}
      {stickyCtaText && (
        <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 p-3 bg-white/95 backdrop-blur border-t border-neutral-200 safe-area-inset-bottom">
          <button
            onClick={onStickyCta}
            className={`w-full rounded-lg py-3.5 text-base font-semibold text-white transition-colors ${
              variant === 'warm'
                ? 'bg-forest-600 active:bg-forest-700'
                : 'bg-navy-accent active:bg-blue-500'
            }`}
          >
            {stickyCtaText}
          </button>
        </div>
      )}
    </div>
  );
}
