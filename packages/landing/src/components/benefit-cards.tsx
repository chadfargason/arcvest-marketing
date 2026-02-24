import { cn } from '@/lib/utils';

interface BenefitCard {
  icon: string;
  title: string;
  description: string;
}

interface BenefitCardsProps {
  variant: 'warm' | 'navy';
  heading?: string;
  subheading?: string;
  cards: readonly BenefitCard[];
}

export function BenefitCards({
  variant,
  heading,
  subheading,
  cards,
}: BenefitCardsProps) {
  return (
    <section
      className={cn(
        'py-16 md:py-24',
        variant === 'warm' && 'bg-white',
        variant === 'navy' && 'bg-navy-800'
      )}
    >
      <div className="container max-w-5xl">
        {heading && (
          <div className="text-center mb-12">
            <h2
              className={cn(
                'text-2xl md:text-3xl font-bold mb-3',
                variant === 'warm' && 'font-serif text-neutral-900',
                variant === 'navy' && 'text-white'
              )}
            >
              {heading}
            </h2>
            {subheading && (
              <p
                className={cn(
                  'text-lg max-w-2xl mx-auto',
                  variant === 'warm' && 'text-neutral-600',
                  variant === 'navy' && 'text-neutral-300'
                )}
              >
                {subheading}
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            'grid gap-6',
            cards.length === 3 && 'md:grid-cols-3',
            cards.length === 4 && 'md:grid-cols-2 lg:grid-cols-4',
            cards.length === 2 && 'md:grid-cols-2'
          )}
        >
          {cards.map((card) => (
            <div
              key={card.title}
              className={cn(
                'rounded-xl p-6 md:p-8',
                variant === 'warm' &&
                  'bg-warm-cream border border-warm-200',
                variant === 'navy' &&
                  'bg-navy-700 border border-navy-600'
              )}
            >
              <div className="text-3xl mb-4">{card.icon}</div>
              <h3
                className={cn(
                  'text-lg font-semibold mb-2',
                  variant === 'warm' && 'text-neutral-900',
                  variant === 'navy' && 'text-white'
                )}
              >
                {card.title}
              </h3>
              <p
                className={cn(
                  'text-base leading-relaxed',
                  variant === 'warm' && 'text-neutral-600',
                  variant === 'navy' && 'text-neutral-300'
                )}
              >
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
