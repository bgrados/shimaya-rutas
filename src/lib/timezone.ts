import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatGroupDate(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  return format(new Date(fechaStr), "EEEE d 'de' MMMM", { locale: es });
}

export function formatGroupDatePdf(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  return format(new Date(fechaStr), 'dd MMMM yyyy', { locale: es });
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '-';
  return format(new Date(dateStr), fmt);
}

export function nowPeru(): string {
  return new Date().toISOString();
}
