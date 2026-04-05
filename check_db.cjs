const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoyStr = '2026-04-05';
  
  console.log('=== RUTAS DE HOY ===');
  const { data: rutas } = await supabase.from('rutas').select('*').eq('fecha', hoyStr);
  console.log('Rutas hoy:', rutas?.map(r => ({ nombre: r.nombre, estado: r.estado })));
  console.log('Pendientes:', rutas?.filter(r => r.estado === 'pendiente').length);
  console.log('En progreso:', rutas?.filter(r => r.estado === 'en_progreso').length);
  console.log('Finalizadas:', rutas?.filter(r => r.estado === 'finalizada').length);
}

check();
