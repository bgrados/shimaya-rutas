const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoy = '2026-04-05';
  
  console.log('=== GASTOS CON FECHA ===');
  const { data: gasto } = await supabase.from('gastos_combustible').select('*, fecha, created_at');
  console.log('Todos:', gasto?.map(g => ({ fecha: g.fecha, created: g.created_at, monto: g.monto })));
  
  console.log('\n=== LOCALES_RUTA CON FECHA ===');
  const { data: locales } = await supabase.from('locales_ruta').select('*, created_at, hora_llegada');
  console.log('Muestra:', locales?.slice(0,3).map(l => ({ nombre: l.nombre, estado: l.estado_visita, created: l.created_at })));
  
  console.log('\n=== RUTAS CON FECHA ===');
  const { data: rutas } = await supabase.from('rutas').select('*, fecha, created_at');
  console.log('Muestra:', rutas?.slice(0,3).map(r => ({ nombre: r.nombre, fecha: r.fecha, estado: r.estado })));
}

check();
