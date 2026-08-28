/**
 * Validate an email address using RFC-compliant regex.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Parse and deduplicate a list of recipient strings.
 */
export function parseRecipients(raw: string[]): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const r of raw) {
    const trimmed = r.trim().toLowerCase();
    if (!trimmed) continue;
    if (!isValidEmail(trimmed)) {
      invalid.push(trimmed);
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    valid.push(trimmed);
  }

  return { valid, invalid };
}
