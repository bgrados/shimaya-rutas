const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  console.log('=== RUTA EN PROGRESO ACTUAL ===');
  const { data: prog } = await supabase.from('rutas').select('*').eq('estado', 'en_progreso');
  console.log('Ruta:', prog);
  
  if (prog && prog.length > 0) {
    console.log('\n=== VISITAS CON hora_llegada DE HOY (05 abril) ===');
    const { data: vis } = await supabase
      .from('locales_ruta')
      .select('nombre, estado_visita, hora_llegada')
      .eq('id_ruta', prog[0].id_ruta)
      .gte('hora_llegada', '2026-04-05T00:00:00')
      .lte('hora_llegada', '2026-04-05T23:59:59');
    console.log('Visitas con llegada hoy:', vis);
    console.log('Total con hora_llegada hoy:', vis?.length);
    
    console.log('\n=== TODAS LAS VISITAS DE LA RUTA ===');
    const { data: todas } = await supabase
      .from('locales_ruta')
      .select('nombre, estado_visita, hora_llegada')
      .eq('id_ruta', prog[0].id_ruta)
      .order('orden');
    console.log('Todas:', todas);
  }
}

check();
