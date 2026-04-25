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

/**
 * Formatea una hora (ISO, HH:mm, etc) a HH:mm
 */
export function formatHoraSimple(horaStr: string | null | undefined): string {
  if (!horaStr) return '-';
  try {
    // Caso 1: "03:30" o "03:30:00" - solo hora
    if (!horaStr.includes('T') && horaStr.includes(':')) {
      return horaStr.substring(0, 5);
    }
    // Caso 2: "2024-04-24T03:30" - ISO sin segundos
    if (horaStr.includes('T') && horaStr.length <= 16) {
      return horaStr.split('T')[1]?.substring(0, 5) || horaStr;
    }
    // Caso 3: "2024-04-24T03:30:00.000Z" - ISO completo
    if (horaStr.includes('T')) {
      const timePart = horaStr.split('T')[1];
      if (timePart) {
        const [h, m] = timePart.split(':');
        return `${h}:${m}`;
      }
    }
    return horaStr;
  } catch {
    return horaStr;
  }
}

/**
 * Formatea una fecha ISO a un formato específico en hora Perú
 */
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
 * Calcula la duración en minutos entre dos horas (maneja HH:mm, ISO, etc.)
 */
export function calcularDuracionMinutos(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  try {
    const soloHora = (h: string) => {
      if (h.includes('T') && h.length <= 16) {
        const parts = h.split('T');
        const timePart = parts[1]?.substring(0, 5) || h;
        const [ho, mi] = timePart.split(':').map(Number);
        return { hora: ho || 0, min: mi || 0 };
      } else if (h.includes('T')) {
        const d = new Date(h);
        return { hora: d.getHours(), min: d.getMinutes() };
      } else if (h.includes(':')) {
        const [ho, mi] = h.split(':').map(Number);
        return { hora: ho || 0, min: mi || 0 };
      }
      return { hora: 0, min: 0 };
    };
    
    const inicio = soloHora(start);
    const fin = soloHora(end);
    
    const minsInicio = inicio.hora * 60 + inicio.min;
    const minsFin = fin.hora * 60 + fin.min;
    
    let diff = minsFin - minsInicio;
    if (diff < 0) diff += 24 * 60;
    
    return diff > 0 && diff < 24 * 60 ? diff : 0;
  } catch {
    return 0;
  }
}

/**
 * Calcula la duración entre dos fechas ISO en minutos/horas
 */
export function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  const mins = calcularDuracionMinutos(start, end);
  if (mins <= 0) return '-';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Formatea una hora simple (HH:mm) - NO usa Date parsing
 */
export function formatTimeOnly(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  // Solo extraer HH:mm sin importar el formato
  if (timeStr.includes('T')) {
    const parts = timeStr.split('T');
    const timePart = parts[1]?.substring(0, 5) || '';
    return timePart || timeStr.substring(0, 5);
  }
  if (timeStr.includes(':')) {
    return timeStr.substring(0, 5);
  }
  return timeStr;
}

/**
 * Convierte timestamp UTC a hora local Perú (HH:mm) - CORRECTO
 */
export function formatHoraLocal(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return formatTimeOnly(isoString);
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Lima'
    }).format(date);
  } catch {
    return formatTimeOnly(isoString);
  }
}
