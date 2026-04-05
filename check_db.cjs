const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoy = '2026-04-05';
  
  console.log('=== FILTRO CON FECHA string ===');
  const { data: gasto1, error: e1 } = await supabase.from('gastos_combustible').select('monto').gte('fecha', `${hoy}T00:00:00`);
  console.log('Error:', e1);
  console.log('Datos:', gasto1);
  console.log('Suma:', gasto1?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0);
  
  console.log('\n=== FILTRO CON FECHA Date object ===');
  const { data: gasto2, error: e2 } = await supabase.from('gastos_combustible').select('monto').gte('fecha', new Date(`${hoy}T00:00:00`).toISOString());
  console.log('Error:', e2);
  console.log('Datos:', gasto2);
  
  console.log('\n=== TODOS LOS GASTOS ===');
  const { data: gasto3 } = await supabase.from('gastos_combustible').select('*');
  console.log('Todos:', gasto3?.map(g => ({ id: g.id_gasto, monto: g.monto, fecha: g.fecha })));
}

check();
