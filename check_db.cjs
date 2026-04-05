const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  // Corregir: si es domingo (day=0), ir a hace 6 días, no sumar 1
  const now = new Date();
  const day = now.getDay();
  const inicioSemana = new Date(now);
  inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
  
  const semanaStr = inicioSemana.toISOString().split('T')[0];
  const hoyStr = now.toISOString().split('T')[0];
  
  console.log('day:', day);
  console.log('semanaStr corregido:', semanaStr);
  console.log('hoyStr:', hoyStr);
  
  console.log('\n=== GASTO SEMANA (lunes 30 - hoy) ===');
  const { data: gastoSemana } = await supabase.from('gastos_combustible').select('*').gte('created_at', `${semanaStr}T00:00:00`);
  console.log('Cantidad:', gastoSemana?.length);
  console.log('Suma:', gastoSemana?.reduce((s, g) => s + (g.monto || 0), 0) || 0);
  
  console.log('\n=== VISITAS DE RUTAS DE HOY ===');
  const { data: rutas } = await supabase.from('rutas').select('id_ruta').eq('fecha', hoyStr);
  console.log('Rutas hoy:', rutas?.length);
  
  if (rutas && rutas.length > 0) {
    const ids = rutas.map(r => r.id_ruta);
    const { data: visitas } = await supabase.from('locales_ruta').select('estado_visita').in('id_ruta', ids);
    console.log('Visitas:', visitas?.length);
    console.log('Completadas:', visitas?.filter(v => v.estado_visita === 'visitado').length);
    console.log('Pendientes:', visitas?.filter(v => v.estado_visita === 'pendiente').length);
  }
}

check();
