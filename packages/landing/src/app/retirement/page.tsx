'use client';

import { useRef } from 'react';
import { retirementPage as page } from '@/config/retirement-page';
import { LandingShell } from '@/components/landing-shell';
import { HeroSection } from '@/components/hero-section';
import { TrustBar } from '@/components/trust-bar';
import { BenefitCards } from '@/components/benefit-cards';
import { StatCounter } from '@/components/stat-counter';
import { TestimonialSection } from '@/components/testimonial-section';
import { LeadForm } from '@/components/lead-form';
import { FAQSection } from '@/components/faq-section';

export default function RetirementPage() {
  const formRef = useRef<HTMLDivElement>(null);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <LandingShell
      variant="warm"
      stickyCtaText="Get Your Free Guide"
      onStickyCta={scrollToForm}
    >
      <HeroSection
        variant="warm"
        badge={page.hero.badge}
        headline={page.hero.headline}
        subheadline={page.hero.subheadline}
        ctaText={page.hero.ctaText}
        onCtaClick={scrollToForm}
        trustLine={page.hero.trustLine}
      />

      <TrustBar variant="warm" items={page.trustBar} />

      <BenefitCards
        variant="warm"
        heading={page.painPoints.heading}
        cards={page.painPoints.cards}
      />

      <BenefitCards
        variant="warm"
        heading={page.approach.heading}
        subheading={page.approach.subheading}
        cards={page.approach.cards}
      />

      <StatCounter variant="warm" stats={page.stats} />

      <TestimonialSection
        variant="warm"
        heading={page.testimonials.heading}
        testimonials={page.testimonials.items}
      />

      <div ref={formRef}>
        <LeadForm
          variant="warm"
          heading={page.leadForm.heading}
          subheading={page.leadForm.subheading}
          buttonText={page.leadForm.buttonText}
          pageSource="retirement"
        />
      </div>

      <FAQSection
        variant="warm"
        heading={page.faqs.heading}
        faqs={page.faqs.items}
      />
    </LandingShell>
  );
}
