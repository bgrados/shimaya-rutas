const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoy = '2026-04-05';
  
  console.log('=== RUTAS DE HOY ===');
  const { data: rutas } = await supabase.from('rutas').select('*').eq('fecha', hoy);
  console.log('Rutas:', rutas?.map(r => ({ nombre: r.nombre, estado: r.estado })));
  
  console.log('\n=== LOCALES POR RUTA ===');
  for (const r of rutas || []) {
    const { data: vis } = await supabase.from('locales_ruta').select('nombre').eq('id_ruta', r.id_ruta);
    console.log(`${r.nombre} (${r.estado}): ${vis?.length} locales`);
  }
  
  console.log('\n=== RESUMEN ===');
  const finalizadas = rutas?.filter(r => r.estado === 'finalizada').length || 0;
  const enProgreso = rutas?.filter(r => r.estado === 'en_progreso').length || 0;
  console.log('Finalizadas:', finalizadas);
  console.log('En progreso:', enProgreso);
  console.log('Viajes (solo finalizadas):', finalizadas);
}

check();
