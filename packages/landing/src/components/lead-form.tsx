'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CTAButton } from './cta-button';
import { trackConversion, trackFormSubmission } from '@/lib/tracking';

interface LeadFormProps {
  variant: 'warm' | 'navy';
  heading: string;
  subheading?: string;
  buttonText: string;
  pageSource: 'retirement' | 'wealth-management';
}

export function LeadForm({
  variant,
  heading,
  subheading,
  buttonText,
  pageSource,
}: LeadFormProps) {
  const [formState, setFormState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('submitting');
    setErrors({});

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.get('firstName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          pageSource,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setFormState('error');
        return;
      }

      setFormState('success');
      trackConversion();
      trackFormSubmission(pageSource);
    } catch {
      setFormState('error');
    }
  }

  if (formState === 'success') {
    return (
      <section
        id="form"
        className={cn(
          'py-16 md:py-24',
          variant === 'warm' && 'bg-forest-600',
          variant === 'navy' && 'bg-navy-900'
        )}
      >
        <div className="container max-w-lg text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Thank You!
          </h2>
          <p className="text-lg text-white/80">
            {pageSource === 'retirement'
              ? "Your free retirement planning guide is on its way. Check your email shortly."
              : "We'll be in touch within 1 business day to schedule your private consultation."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="form"
      className={cn(
        'py-16 md:py-24',
        variant === 'warm' && 'bg-forest-600',
        variant === 'navy' && 'bg-navy-900'
      )}
    >
      <div className="container max-w-lg">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            {heading}
          </h2>
          {subheading && (
            <p className="text-lg text-white/80">{subheading}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="sr-only">
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="First Name"
              required
              className={cn(
                'w-full rounded-lg px-4 py-3.5 text-base bg-white text-neutral-900 placeholder-neutral-400',
                'focus:outline-none focus:ring-2',
                variant === 'warm' && 'focus:ring-warm-400',
                variant === 'navy' && 'focus:ring-navy-accent',
                errors.firstName && 'ring-2 ring-red-400'
              )}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-300">
                {errors.firstName[0]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email Address"
              required
              className={cn(
                'w-full rounded-lg px-4 py-3.5 text-base bg-white text-neutral-900 placeholder-neutral-400',
                'focus:outline-none focus:ring-2',
                variant === 'warm' && 'focus:ring-warm-400',
                variant === 'navy' && 'focus:ring-navy-accent',
                errors.email && 'ring-2 ring-red-400'
              )}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-300">{errors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="sr-only">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Phone Number"
              required
              className={cn(
                'w-full rounded-lg px-4 py-3.5 text-base bg-white text-neutral-900 placeholder-neutral-400',
                'focus:outline-none focus:ring-2',
                variant === 'warm' && 'focus:ring-warm-400',
                variant === 'navy' && 'focus:ring-navy-accent',
                errors.phone && 'ring-2 ring-red-400'
              )}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-300">{errors.phone[0]}</p>
            )}
          </div>

          {formState === 'error' && !Object.keys(errors).length && (
            <p className="text-sm text-red-300 text-center">
              Something went wrong. Please try again.
            </p>
          )}

          <CTAButton
            variant={variant === 'warm' ? 'navy' : 'warm'}
            type="submit"
            disabled={formState === 'submitting'}
            className="w-full"
          >
            {formState === 'submitting' ? 'Sending...' : buttonText}
          </CTAButton>

          <p className="text-center text-xs text-white/60">
            Your information is secure and will never be shared.
          </p>
        </form>
      </div>
    </section>
  );
}
