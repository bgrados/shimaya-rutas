import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cvbdhjomyywvyqvhrtci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg'
);

async function diagnose() {
  // 1. Rutas base activas
  const { data: rutasBase, error: e1 } = await supabase.from('rutas_base').select('*').eq('activo', true);
  console.log('\n1. Rutas base activas:', rutasBase?.length ?? 0, e1 ? '❌ '+e1.message : '✅');
  rutasBase?.forEach(r => console.log('   -', r.id_ruta_base, r.nombre));

  // 2. Locales por ruta base
  if (rutasBase?.length > 0) {
    for (const rb of rutasBase) {
      const { data: locs } = await supabase.from('locales_base').select('id_local_base, nombre, orden').eq('id_ruta_base', rb.id_ruta_base).order('orden');
      console.log(`\n2. Locales de "${rb.nombre}":`, locs?.length ?? 0);
      locs?.forEach(l => console.log('   -', l.orden, l.nombre));
    }
  }

  // 3. Usuarios de tipo chofer
  const { data: choferes, error: e3 } = await supabase.from('usuarios').select('id_usuario, nombre, email, rol').eq('rol', 'chofer');
  console.log('\n3. Choferes en sistema:', choferes?.length ?? 0, e3 ? '❌ '+e3.message : '✅');
  choferes?.forEach(c => console.log('   -', c.nombre, c.email, c.id_usuario));

  // 4. Rutas de HOY
  const today = new Date().toISOString().split('T')[0];
  const { data: rutasHoy, error: e4 } = await supabase.from('rutas').select('id_ruta, nombre, estado, fecha, id_chofer').eq('fecha', today);
  console.log('\n4. Rutas de hoy ('+today+'):', rutasHoy?.length ?? 0, e4 ? '❌ '+e4.message : '✅');
  rutasHoy?.forEach(r => console.log('   -', r.nombre, r.estado, 'chofer:', r.id_chofer));

  // 5. Tabla locales_ruta - verificar columnas
  const { data: sampleRuta } = await supabase.from('locales_ruta').select('*').limit(1);
  console.log('\n5. Columnas de locales_ruta:', sampleRuta && sampleRuta.length > 0 ? Object.keys(sampleRuta[0]).join(', ') : 'sin datos');

  // 6. Tabla locales_base - verificar columnas
  const { data: sampleBase } = await supabase.from('locales_base').select('*').limit(1);
  console.log('\n6. Columnas de locales_base:', sampleBase && sampleBase.length > 0 ? Object.keys(sampleBase[0]).join(', ') : 'sin datos');
}

diagnose().catch(console.error);
