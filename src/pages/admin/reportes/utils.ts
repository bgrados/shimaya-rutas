import { differenceInMinutes, format, startOfMonth, endOfMonth } from 'date-fns';

export type Period = 'diario' | 'semanal' | 'mensual';

export function formatMins(mins: number | null) {
  if (mins === null || mins === undefined || isNaN(mins as number)) return '-';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const calcularDistanciaHaversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function getRange(p: Period, date: string): { from: string; to: string } {
  const d = new Date(date + 'T12:00:00');

  if (p === 'diario') {
    return { from: date, to: date };
  } else if (p === 'semanal') {
    const fromDate = new Date(d);
    fromDate.setDate(d.getDate() - 7);
    return { from: format(fromDate, 'yyyy-MM-dd'), to: date };
  } else {
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
  }
}
