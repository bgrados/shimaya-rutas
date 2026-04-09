import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatGroupDate(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  const d = addDays(new Date(fechaStr), 1);
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

export function formatGroupDatePdf(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  const d = addDays(new Date(fechaStr), 1);
  return format(d, 'dd MMMM yyyy', { locale: es });
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '-';
  return format(new Date(dateStr), fmt);
}

export function nowPeru(): string {
  return new Date().toISOString();
}
