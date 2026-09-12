// Lightweight product analytics. Events go to gtag when a measurement tag is
// present, and are always mirrored to the console in development so flows can
// be debugged without a analytics provider configured.

type EventName =
  | 'boost_flow_opened'
  | 'boost_campaign_submitted'
  | 'boost_campaign_created'
  | 'boost_campaign_failed'
  | 'draft_resume_opened'
  | 'draft_resume_loaded'
  | 'draft_resume_failed';

type EventProps = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: EventName, props: EventProps = {}) {
  const payload = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') gtag('event', name, payload);
  } catch {
    /* analytics must never break the app */
  }
  if (import.meta.env.DEV) console.debug('[analytics]', name, payload);
}
