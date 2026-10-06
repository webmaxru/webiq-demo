const SESSION_KEY = 'webiq:rate-limit-session';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function createSessionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const random = new Uint8Array(24);
  crypto.getRandomValues(random);
  return Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getRateLimitSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && SESSION_ID_PATTERN.test(existing)) {
      return existing;
    }

    const created = createSessionId();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return createSessionId();
  }
}
