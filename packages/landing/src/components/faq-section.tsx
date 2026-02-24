'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  variant: 'warm' | 'navy';
  heading?: string;
  faqs: readonly FAQ[];
}

export function FAQSection({ variant, heading, faqs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      className={cn(
        'py-16 md:py-24',
        variant === 'warm' && 'bg-white',
        variant === 'navy' && 'bg-navy-800'
      )}
    >
      <div className="container max-w-3xl">
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

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className={cn(
                  'rounded-lg border overflow-hidden',
                  variant === 'warm' && 'border-warm-200 bg-warm-cream',
                  variant === 'navy' && 'border-navy-600 bg-navy-700'
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className={cn(
                    'w-full flex items-center justify-between p-5 text-left min-h-[44px]',
                    variant === 'warm' &&
                      'text-neutral-900 hover:bg-warm-100',
                    variant === 'navy' &&
                      'text-white hover:bg-navy-600'
                  )}
                >
                  <span className="font-medium pr-4">{faq.question}</span>
                  <span
                    className={cn(
                      'flex-shrink-0 transition-transform duration-200 text-xl',
                      isOpen && 'rotate-45'
                    )}
                  >
                    +
                  </span>
                </button>
                <div
                  className={cn('faq-content', isOpen && 'open')}
                >
                  <div>
                    <p
                      className={cn(
                        'px-5 pb-5 text-base leading-relaxed',
                        variant === 'warm' && 'text-neutral-600',
                        variant === 'navy' && 'text-neutral-300'
                      )}
                    >
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
