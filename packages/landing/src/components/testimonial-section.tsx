import { cn } from '@/lib/utils';

interface Testimonial {
  quote: string;
  name: string;
  title: string;
}

interface TestimonialSectionProps {
  variant: 'warm' | 'navy';
  heading?: string;
  testimonials: readonly Testimonial[];
}

export function TestimonialSection({
  variant,
  heading,
  testimonials,
}: TestimonialSectionProps) {
  return (
    <section
      className={cn(
        'py-16 md:py-24',
        variant === 'warm' && 'bg-warm-cream',
        variant === 'navy' && 'bg-navy-700'
      )}
    >
      <div className="container max-w-5xl">
        {heading && (
          <h2
            className={cn(
              'text-2xl md:text-3xl font-bold text-center mb-12',
              variant === 'warm' && 'font-serif text-neutral-900',
              variant === 'navy' && 'text-white'
            )}
          >
            {heading}
          </h2>
        )}

        <div
          className={cn(
            'grid gap-8',
            testimonials.length >= 2 && 'md:grid-cols-2',
            testimonials.length === 3 && 'lg:grid-cols-3'
          )}
        >
          {testimonials.map((testimonial) => (
            <blockquote
              key={testimonial.name}
              className={cn(
                'rounded-xl p-6 md:p-8',
                variant === 'warm' && 'bg-white border border-warm-200',
                variant === 'navy' && 'bg-navy-800 border border-navy-600'
              )}
            >
              <p
                className={cn(
                  'text-base leading-relaxed mb-4 italic',
                  variant === 'warm' && 'text-neutral-700',
                  variant === 'navy' && 'text-neutral-300'
                )}
              >
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <footer>
                <div
                  className={cn(
                    'font-semibold text-sm',
                    variant === 'warm' && 'text-neutral-900',
                    variant === 'navy' && 'text-white'
                  )}
                >
                  {testimonial.name}
                </div>
                <div
                  className={cn(
                    'text-sm',
                    variant === 'warm' && 'text-neutral-500',
                    variant === 'navy' && 'text-neutral-400'
                  )}
                >
                  {testimonial.title}
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
