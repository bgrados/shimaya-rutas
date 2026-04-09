import { format } from 'date-fns';

const PERU_OFFSET_HOURS = 5;

export function toPeruTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(d.getHours() + PERU_OFFSET_HOURS);
  return d;
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  const peru = toPeruTime(dateStr);
  return peru ? format(peru, fmt) : '-';
}

export function nowPeru(): string {
  const now = new Date();
  now.setHours(now.getHours() - PERU_OFFSET_HOURS);
  return now.toISOString();
}
