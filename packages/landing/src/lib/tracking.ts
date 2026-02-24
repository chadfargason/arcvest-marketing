declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackConversion(conversionLabel?: string) {
  const gtagId = process.env.NEXT_PUBLIC_GTAG_ID;
  if (!gtagId || !window.gtag) return;

  window.gtag('event', 'conversion', {
    send_to: conversionLabel || gtagId,
  });
}

export function trackFormSubmission(pageName: string) {
  if (!window.gtag) return;

  window.gtag('event', 'form_submission', {
    event_category: 'lead',
    event_label: pageName,
  });
}
