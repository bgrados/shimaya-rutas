const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  // Solo rutas EN PROGRESO
  console.log('=== SOLO RUTAS EN PROGRESO ===');
  const { data: prog } = await supabase.from('rutas').select('id_ruta, nombre').eq('estado', 'en_progreso');
  console.log('Rutas en progreso:', prog);
  
  if (prog && prog.length > 0) {
    const ids = prog.map(r => r.id_ruta);
    const { data: vis } = await supabase.from('locales_ruta').select('nombre, estado_visita').in('id_ruta', ids);
    console.log('Visitas:', vis);
    console.log('Completadas:', vis?.filter(v => v.estado_visita === 'visitado').length);
    console.log('Pendientes:', vis?.filter(v => v.estado_visita === 'pendiente').length);
  }
}

check();
