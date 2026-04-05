const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const now = new Date();
  const hoyStr = now.toISOString().split('T')[0];
  
  console.log('HOY:', hoyStr);
  
  console.log('\n=== TODAS LAS RUTAS ===');
  const { data: rutas } = await supabase.from('rutas').select('*').order('created_at', { ascending: false });
  console.log('Rutas:', rutas?.map(r => ({ nombre: r.nombre, fecha: r.fecha, estado: r.estado })));
  
  console.log('\n=== RUTAS DE HOY ===');
  const { data: rutasHoy } = await supabase.from('rutas').select('*').eq('fecha', hoyStr);
  console.log('Rutas hoy:', rutasHoy?.map(r => ({ nombre: r.nombre, estado: r.estado })));
  console.log('En progreso:', rutasHoy?.filter(r => r.estado === 'en_progreso').length);
  console.log('Pendientes:', rutasHoy?.filter(r => r.estado === 'pendiente').length);
  console.log('Finalizadas:', rutasHoy?.filter(r => r.estado === 'finalizada').length);
  
  if (rutasHoy && rutasHoy.length > 0) {
    const ids = rutasHoy.map(r => r.id_ruta);
    console.log('\n=== VISITAS PARA RUTAS DE HOY ===');
    const { data: vis } = await supabase.from('locales_ruta').select('estado_visita').in('id_ruta', ids);
    console.log('Total locales:', vis?.length);
    console.log('Visitados:', vis?.filter(v => v.estado_visita === 'visitado').length);
    console.log('Pendientes:', vis?.filter(v => v.estado_visita === 'pendiente').length);
  }
}

check();
