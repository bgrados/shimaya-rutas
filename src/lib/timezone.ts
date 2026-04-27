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

export function formatFriendlyDate(fechaStr: string | null | undefined): string {
  if (!fechaStr) return '-';
  try {
    // Extraer solo la parte YYYY-MM-DD para evitar desfases por hora/zona horaria
    const datePart = fechaStr.split('T')[0];
    const date = new Date(datePart + 'T12:00:00');
    return format(date, "d MMM, yyyy", { locale: es });
  } catch (e) {
    return fechaStr;
  }
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), fmt, { locale: es });
  } catch (e) {
    return '-';
  }
}

export function nowPeru(): string {
  return new Date().toISOString();
}

/**
 * Obtiene el lunes de la semana en formato YYYY-MM-DD
 */
export function getStartOfCurrentWeek(baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0: Domingo, 1: Lunes, ...
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(d.setDate(diff));
  return format(monday, 'yyyy-MM-dd');
}

/**
 * Obtiene el domingo de la semana en formato YYYY-MM-DD
 */
export function getEndOfCurrentWeek(baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  const sunday = new Date(d.setDate(diff));
  return format(sunday, 'yyyy-MM-dd');
}

/**
 * Convierte una fecha ISO (UTC) a HH:mm en hora de Perú (UTC-5)
 */
export function formatHoraPeru(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Lima'
    }).format(date);
  } catch (e) {
    return '-';
  }
}

/**
 * Calcula la duración entre dos fechas ISO en minutos/horas
 */
export function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '-';
  try {
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    if (isNaN(diffMs) || diffMs < 0) return '-';
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } catch {
    return '-';
  }
}
