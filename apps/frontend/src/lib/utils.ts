import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function parseCsvEmails(text: string): { valid: string[]; invalid: string[] } {
  const lines = text
    .split(/[\n,;\r]+/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    if (isValidEmail(line)) {
      valid.push(line);
    } else {
      invalid.push(line);
    }
  }

  return { valid, invalid };
}
