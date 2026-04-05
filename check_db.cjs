const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoy = '2026-04-05';
  
  console.log('=== VISITAS CON hora_llegada HOY ===');
  const { data: visitasHoy } = await supabase
    .from('locales_ruta')
    .select('*, hora_llegada, hora_salida')
    .gte('hora_llegada', `${hoy}T00:00:00`)
    .lte('hora_llegada', `${hoy}T23:59:59`);
  console.log('Visitas con llegada hoy:', visitasHoy);
  
  console.log('\n=== VISITAS PENDIENTES DE RUTAS EN PROGRESO ===');
  const { data: rutasProgreso } = await supabase.from('rutas').select('id_ruta').eq('estado', 'en_progreso');
  if (rutasProgreso && rutasProgreso.length > 0) {
    const ids = rutasProgreso.map(r => r.id_ruta);
    const { data: pend } = await supabase.from('locales_ruta').select('*').in('id_ruta', ids).eq('estado_visita', 'pendiente');
    console.log('Pendientes en rutas en progreso:', pend?.length);
    console.log('Detalles:', pend?.map(p => ({ nombre: p.nombre, estado: p.estado_visita })));
  }
  
  console.log('\n=== RESUMEN ===');
  console.log('Visitas completadas hoy:', visitasHoy?.filter(v => v.estado_visita === 'visitado').length);
  console.log('Visitas pendientes (en progreso):', rutasProgreso?.length > 0 ? (await supabase.from('locales_ruta').select('*', { count: 'exact', head: true }).in('id_ruta', rutasProgreso.map(r => r.id_ruta)).eq('estado_visita', 'pendiente')).count : 0);
}

check();
