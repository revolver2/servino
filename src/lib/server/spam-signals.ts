/**
 * Spam signals for the public contact submission (spec sections 30–31).
 * Deliberately NOT exposed as a single boolean "isBot" — honeypot is a
 * hard signal (real users never fill a hidden field), timing is soft (one
 * signal among others, logged but never solely blocking, since legitimate
 * users with autofill or fast typers can submit quickly).
 */

const MIN_PLAUSIBLE_SUBMIT_MS = 1000;

export function honeypotTripped(honeypotValue: string | undefined | null): boolean {
  return Boolean(honeypotValue && honeypotValue.trim().length > 0);
}

export function isSuspiciouslyFast(formRenderedAtIso: string | undefined | null): boolean {
  if (!formRenderedAtIso) return false;
  const renderedAt = new Date(formRenderedAtIso).getTime();
  if (Number.isNaN(renderedAt)) return false;
  return Date.now() - renderedAt < MIN_PLAUSIBLE_SUBMIT_MS;
}
