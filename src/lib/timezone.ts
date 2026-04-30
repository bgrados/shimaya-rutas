import { formatInTimeZone, toDate } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const TIMEZONE = 'America/Lima';

export function formatGroupDate(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  try {
    return formatInTimeZone(new Date(fechaStr), TIMEZONE, "EEEE d 'de' MMMM", { locale: es });
  } catch (e) {
    return '-';
  }
}

export function formatGroupDatePdf(fechaStr: string): string {
  if (!fechaStr || fechaStr === 'sin fecha') return '-';
  try {
    return formatInTimeZone(new Date(fechaStr), TIMEZONE, 'dd MMMM yyyy', { locale: es });
  } catch (e) {
    return '-';
  }
}

export function formatFriendlyDate(fechaStr: string | null | undefined): string {
  if (!fechaStr) return '-';
  try {
    // Si la cadena ya incluye T, la interpretamos directamente como UTC o con su offset original.
    // Si es solo YYYY-MM-DD, asumimos que representa medianoche en Lima.
    const dateToFormat = fechaStr.includes('T') ? new Date(fechaStr) : toDate(fechaStr + 'T00:00:00', { timeZone: TIMEZONE });
    return formatInTimeZone(dateToFormat, TIMEZONE, "d MMM, yyyy", { locale: es });
  } catch (e) {
    return fechaStr;
  }
}

export function formatPeru(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '-';
  try {
    // Igual que arriba, manejamos YYYY-MM-DD como medianoche en Lima
    const dateToFormat = dateStr.includes('T') ? new Date(dateStr) : toDate(dateStr + 'T00:00:00', { timeZone: TIMEZONE });
    return formatInTimeZone(dateToFormat, TIMEZONE, fmt, { locale: es });
  } catch (e) {
    return '-';
  }
}

export function nowPeru(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
}

export function startOfDayPeru(baseDate: Date = new Date()): string {
  return formatInTimeZone(baseDate, TIMEZONE, "yyyy-MM-dd'T'00:00:00.000xxx");
}

export function endOfDayPeru(baseDate: Date = new Date()): string {
  return formatInTimeZone(baseDate, TIMEZONE, "yyyy-MM-dd'T'23:59:59.999xxx");
}

export function formatOnlyDatePeru(baseDate: Date = new Date()): string {
  return formatInTimeZone(baseDate, TIMEZONE, "yyyy-MM-dd");
}

/**
 * Obtiene el lunes de la semana en formato YYYY-MM-DD (hora Lima)
 */
export function getStartOfCurrentWeek(baseDate: Date = new Date()): string {
  // Obtenemos la fecha actual en la zona horaria de Lima
  const limaStr = formatInTimeZone(baseDate, TIMEZONE, "yyyy-MM-dd'T'00:00:00");
  const d = new Date(limaStr);
  const day = d.getDay(); // 0: Domingo, 1: Lunes, ...
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(d.setDate(diff));
  return formatInTimeZone(monday, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Obtiene el domingo de la semana en formato YYYY-MM-DD (hora Lima)
 */
export function getEndOfCurrentWeek(baseDate: Date = new Date()): string {
  const limaStr = formatInTimeZone(baseDate, TIMEZONE, "yyyy-MM-dd'T'00:00:00");
  const d = new Date(limaStr);
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  const sunday = new Date(d.setDate(diff));
  return formatInTimeZone(sunday, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Convierte una fecha ISO a HH:mm en hora de Perú (UTC-5)
 */
export function formatHoraPeru(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    return formatInTimeZone(new Date(isoString), TIMEZONE, 'HH:mm');
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
