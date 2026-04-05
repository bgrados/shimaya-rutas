const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  console.log('=== TODAS LAS RUTAS ===');
  const { data: rutas } = await supabase.from('rutas').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Rutas:', rutas?.map(r => ({ nombre: r.nombre, estado: r.estado, fecha: r.fecha })));
  
  console.log('\n=== RUTAS EN PROGRESO ===');
  const { data: prog } = await supabase.from('rutas').select('*').eq('estado', 'en_progreso');
  console.log('En progreso:', prog?.length);
  
  console.log('\n=== RUTAS DE HOY ===');
  const { data: hoy } = await supabase.from('rutas').select('*').eq('fecha', '2026-04-05');
  console.log('Hoy:', hoy?.map(r => ({ nombre: r.nombre, estado: r.estado })));
}

check();
