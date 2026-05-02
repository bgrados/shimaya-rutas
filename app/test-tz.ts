import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const date = new Date('2024-05-15T03:00:00.000Z'); // 3 AM UTC is 10 PM Lima (previous day)
console.log(formatInTimeZone(date, 'America/Lima', 'yyyy-MM-dd HH:mm', { locale: es }));
