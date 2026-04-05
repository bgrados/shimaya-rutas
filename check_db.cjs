const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  console.log('=== RUTAS EN PROGRESO ===');
  const { data: rutas } = await supabase.from('rutas').select('id_ruta, nombre').eq('estado', 'en_progreso');
  console.log('Rutas:', JSON.stringify(rutas, null, 2));
  
  if (rutas && rutas.length > 0) {
    for (const ruta of rutas) {
      console.log(`\n=== LOCALES para ruta ${ruta.nombre} (${ruta.id_ruta}) ===`);
      const { data: locales } = await supabase.from('locales_ruta')
        .select('*')
        .eq('id_ruta', ruta.id_ruta);
      console.log('Locales:', JSON.stringify(locales, null, 2));
    }
  }
  
  console.log('\n=== HOY 2026-04-05 ===');
  const { data: rutasHoy } = await supabase.from('rutas')
    .select('id_ruta, nombre, estado, fecha')
    .eq('fecha', '2026-04-05');
  console.log('Rutas hoy:', JSON.stringify(rutasHoy, null, 2));
  
  if (rutasHoy && rutasHoy.length > 0) {
    for (const ruta of rutasHoy) {
      const { count } = await supabase.from('locales_ruta')
        .select('*', { count: 'exact', head: true })
        .eq('id_ruta', ruta.id_ruta);
      console.log(`Ruta ${ruta.nombre}: ${count} locales`);
    }
  }
}

check();
