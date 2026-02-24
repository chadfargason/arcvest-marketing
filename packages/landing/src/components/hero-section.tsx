import { cn } from '@/lib/utils';
import { CTAButton } from './cta-button';

interface HeroSectionProps {
  variant: 'warm' | 'navy';
  headline: string;
  subheadline: string;
  ctaText: string;
  onCtaClick?: () => void;
  trustLine?: string;
  badge?: string;
}

export function HeroSection({
  variant,
  headline,
  subheadline,
  ctaText,
  onCtaClick,
  trustLine,
  badge,
}: HeroSectionProps) {
  return (
    <section
      className={cn(
        'relative py-16 md:py-24 lg:py-32',
        variant === 'warm' && 'bg-warm-cream',
        variant === 'navy' &&
          'bg-gradient-to-br from-navy-800 via-navy-700 to-navy-600 text-white'
      )}
    >
      <div className="container max-w-4xl text-center">
        {badge && (
          <span
            className={cn(
              'inline-block mb-6 px-4 py-1.5 rounded-full text-sm font-medium',
              variant === 'warm' &&
                'bg-warm-200 text-warm-800',
              variant === 'navy' &&
                'bg-white/10 text-white/90 border border-white/20'
            )}
          >
            {badge}
          </span>
        )}

        <h1
          className={cn(
            'text-hero-mobile md:text-hero font-bold mb-6',
            variant === 'warm' && 'font-serif text-neutral-900',
            variant === 'navy' && 'font-sans text-white'
          )}
        >
          {headline}
        </h1>

        <p
          className={cn(
            'text-subhero max-w-2xl mx-auto mb-10',
            variant === 'warm' && 'text-neutral-600',
            variant === 'navy' && 'text-neutral-300'
          )}
        >
          {subheadline}
        </p>

        <CTAButton variant={variant} onClick={onCtaClick}>
          {ctaText}
        </CTAButton>

        {trustLine && (
          <p
            className={cn(
              'mt-6 text-sm',
              variant === 'warm' && 'text-neutral-500',
              variant === 'navy' && 'text-neutral-400'
            )}
          >
            {trustLine}
          </p>
        )}
      </div>
    </section>
  );
}
