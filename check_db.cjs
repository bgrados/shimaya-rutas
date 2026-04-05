const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoy = '2026-04-05';
  const fechaSemana = '2026-04-05'; // Monday
  
  console.log('=== GASTOS COMBUSTIBLE HOY ===');
  const { data: gastoHoy } = await supabase.from('gastos_combustible').select('*').gte('created_at', `${hoy}T00:00:00`);
  console.log('Gastos hoy:', JSON.stringify(gastoHoy, null, 2));
  
  console.log('\n=== GASTOS COMBUSTIBLE SEMANA ===');
  const { data: gastoSemana } = await supabase.from('gastos_combustible').select('*').gte('created_at', `${fechaSemana}T00:00:00`);
  console.log('Gastos semana:', JSON.stringify(gastoSemana, null, 2));
  
  console.log('\n=== USUARIOS CHOFER ===');
  const { data: choferes } = await supabase.from('usuarios').select('*').eq('rol', 'chofer');
  console.log('Choferes:', JSON.stringify(choferes, null, 2));
  
  console.log('\n=== RUTAS HOY ===');
  const { data: rutas } = await supabase.from('rutas').select('*').eq('fecha', hoy);
  console.log('Rutas hoy:', JSON.stringify(rutas, null, 2));
}

check();
