import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatGroupDate(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  const d = new Date(fechaStr + 'T12:00:00-05:00');
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

export function formatGroupDatePdf(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  const d = new Date(fechaStr + 'T12:00:00-05:00');
  return format(d, 'dd MMMM yyyy', { locale: es });
}

export function toPeruTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr);
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  const peru = toPeruTime(dateStr);
  return peru ? format(peru, fmt) : '-';
}

export function nowPeru(): string {
  return new Date().toISOString();
}
