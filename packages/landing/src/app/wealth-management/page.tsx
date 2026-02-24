'use client';

import { useRef } from 'react';
import { hnwPage as page } from '@/config/hnw-page';
import { LandingShell } from '@/components/landing-shell';
import { HeroSection } from '@/components/hero-section';
import { TrustBar } from '@/components/trust-bar';
import { BenefitCards } from '@/components/benefit-cards';
import { StatCounter } from '@/components/stat-counter';
import { LeadForm } from '@/components/lead-form';
import { FAQSection } from '@/components/faq-section';
import { cn } from '@/lib/utils';

export default function WealthManagementPage() {
  const formRef = useRef<HTMLDivElement>(null);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <LandingShell
      variant="navy"
      stickyCtaText="Request Consultation"
      onStickyCta={scrollToForm}
    >
      <HeroSection
        variant="navy"
        badge={page.hero.badge}
        headline={page.hero.headline}
        subheadline={page.hero.subheadline}
        ctaText={page.hero.ctaText}
        onCtaClick={scrollToForm}
        trustLine={page.hero.trustLine}
      />

      <TrustBar variant="navy" items={page.trustBar} />

      <BenefitCards
        variant="navy"
        heading={page.problem.heading}
        subheading={page.problem.subheading}
        cards={page.problem.cards}
      />

      <BenefitCards
        variant="navy"
        heading={page.approach.heading}
        subheading={page.approach.subheading}
        cards={page.approach.cards}
      />

      {/* Credentials section - unique to HNW page */}
      <section className="py-16 md:py-24 bg-navy-900">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {page.credentials.heading}
          </h2>
          <p className="text-lg text-neutral-300 mb-10">
            {page.credentials.description}
          </p>
          <ul className="space-y-4 text-left max-w-xl mx-auto">
            {page.credentials.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-neutral-300"
              >
                <span className="text-navy-accent mt-1 flex-shrink-0">
                  &#10003;
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <StatCounter variant="navy" stats={page.stats} />

      <div ref={formRef}>
        <LeadForm
          variant="navy"
          heading={page.leadForm.heading}
          subheading={page.leadForm.subheading}
          buttonText={page.leadForm.buttonText}
          pageSource="wealth-management"
        />
      </div>

      <FAQSection
        variant="navy"
        heading={page.faqs.heading}
        faqs={page.faqs.items}
      />
    </LandingShell>
  );
}
