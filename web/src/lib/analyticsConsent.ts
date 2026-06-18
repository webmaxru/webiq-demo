// Analytics opt-out preference.
//
// The sandbox sets no cookies and stores nothing on the device for tracking, so
// no consent banner is required under the EU ePrivacy Directive. The only data
// processing is privacy-preserving, server-side usage telemetry under legitimate
// interest — and GDPR Art. 21 gives visitors the right to object. This module
// implements that opt-out.
//
// The single flag below is "strictly necessary" to honour the user's explicit
// choice, so persisting it in localStorage is itself exempt from consent.

const OPT_OUT_KEY = 'webiq:analytics-opt-out';

/** Header the API client sends so the server can suppress telemetry for this visitor. */
export const ANALYTICS_OPT_OUT_HEADER = 'X-WebIQ-Analytics';
export const ANALYTICS_OPT_OUT_VALUE = 'off';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * True when the visitor's browser signals a global privacy preference
 * (Do Not Track or Global Privacy Control). We honour these automatically.
 */
export function browserSignalsOptOut(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const dnt =
      nav.doNotTrack ??
      (window as unknown as { doNotTrack?: string }).doNotTrack ??
      (nav as unknown as { msDoNotTrack?: string }).msDoNotTrack;

    return dnt === '1' || dnt === 'yes' || nav.globalPrivacyControl === true;
  } catch {
    return false;
  }
}

/** True when analytics should be suppressed for this visitor. */
export function isAnalyticsOptedOut(): boolean {
  return browserSignalsOptOut() || readStored();
}

/** Persist (or clear) the explicit opt-out choice. */
export function setAnalyticsOptedOut(optedOut: boolean): void {
  try {
    if (optedOut) {
      window.localStorage.setItem(OPT_OUT_KEY, '1');
    } else {
      window.localStorage.removeItem(OPT_OUT_KEY);
    }
  } catch {
    // localStorage unavailable (e.g. private mode) — nothing to persist.
  }
}
