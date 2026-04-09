import { format } from 'date-fns';

export function toPeruTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr);
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '-';
  return format(new Date(dateStr), fmt);
}

export function nowPeru(): string {
  return new Date().toISOString();
}
