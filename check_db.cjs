const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  const hoy = '2026-04-05';
  
  console.log('=== RUTAS DE HOY ===');
  const { data: rutas } = await supabase.from('rutas').select('id_ruta, nombre, estado').eq('fecha', hoy);
  console.log('Rutas hoy:', rutas);
  const rutasIds = rutas?.map(r => r.id_ruta) || [];
  console.log('IDs:', rutasIds);
  
  console.log('\n=== VISITAS PARA RUTAS DE HOY ===');
  if (rutasIds.length > 0) {
    const { data: visitas } = await supabase.from('locales_ruta').select('*').in('id_ruta', rutasIds);
    console.log('Visitas:', visitas?.map(v => ({ nombre: v.nombre, estado: v.estado_visita })));
  }
  
  console.log('\n=== CONTEO CARGAS HOY ===');
  const { count: cargasCount } = await supabase.from('gastos_combustible').select('*', { count: 'exact', head: true }).gte('fecha', `${hoy}T00:00:00`);
  console.log('Conteo:', cargasCount);
  
  console.log('\n=== SUMA GASTO HOY ===');
  const { data: gastoHoy } = await supabase.from('gastos_combustible').select('monto').gte('fecha', `${hoy}T00:00:00`);
  console.log('Gasto hoy data:', gastoHoy);
  console.log('Suma:', gastoHoy?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0);
  
  console.log('\n=== SUMA GASTO SEMANA (31 marzo - 5 abril) ===');
  const { data: gastoSemana } = await supabase.from('gastos_combustible').select('monto').gte('fecha', '2026-03-31T00:00:00');
  console.log('Gasto semana data:', gastoSemana);
  console.log('Suma:', gastoSemana?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0);
}

check();
