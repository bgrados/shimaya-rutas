const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function reinit() {
  console.log('--- REINICIO TOTAL VOL. 2 (ESTRUCTURA COMPLETA) ---');

  // Limpiar TODO
  console.log('Limpiando tablas...');
  await supabase.from('viajes_bitacora').delete().neq('id_bitacora', '00000000-0000-0000-0000-000000000000');
  await supabase.from('locales_ruta').delete().neq('id_local_ruta', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rutas').delete().neq('id_ruta', '00000000-0000-0000-0000-000000000000');
  await supabase.from('locales_base').delete().neq('id_local_base', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rutas_base').delete().neq('id_ruta_base', '00000000-0000-0000-0000-000000000000');

  // 1. Crear 4 Choferes
  console.log('Configurando choferes...');
  const choferes = [
    { id: 'da077e98-f24c-45da-9e54-2bd983ebd5ca', nombre: 'Chofer 1', email: 'benja@shimaya.com' },
    { id: '2769fdea-680e-4b0f-a278-19e49440ae8a', nombre: 'Chofer 2', email: 'chofer@shimaya.com' },
    { id: '11111111-1111-1111-1111-111111111111', nombre: 'Chofer 3', email: 'chofer3@shimaya.com' },
    { id: '22222222-2222-2222-2222-222222222222', nombre: 'Chofer 4', email: 'chofer4@shimaya.com' }
  ];

  for (const c of choferes) {
    const { error } = await supabase.from('usuarios').upsert({ id_usuario: c.id, nombre: c.nombre, email: c.email, rol: 'chofer', activo: true }, { onConflict: 'email' });
    if (error) console.error('Error chofer:', error);
  }

  // 2. Crear 4 Rutas Base
  console.log('Configurando plantillas...');
  const templates = [
    { id: '10000000-0000-0000-0000-000000000001', nombre: 'Ruta Negra - Norte' },
    { id: '10000000-0000-0000-0000-000000000002', nombre: 'Ruta Guinda - Sur' },
    { id: '10000000-0000-0000-0000-000000000003', nombre: 'Ruta Verde - Este' },
    { id: '10000000-0000-0000-0000-000000000004', nombre: 'Ruta Amarilla - Oeste' }
  ];

  for (const t of templates) {
    const { error: rbError } = await supabase.from('rutas_base').insert({ id_ruta_base: t.id, nombre: t.nombre, activo: true });
    if (rbError) console.error('Error rutas_base:', rbError);
    
    // Locales Base
    const locales = [
      { nombre: 'Miraflores', orden: 1 },
      { nombre: 'San Isidro', orden: 2 },
      { nombre: 'Barranco', orden: 3 }
    ];

    for (const l of locales) {
      const { error: lbError } = await supabase.from('locales_base').insert({
        id_ruta_base: t.id,
        nombre: l.nombre,
        orden: l.orden
      });
      if (lbError) console.error('Error locales_base:', lbError);
    }
  }

  console.log('--- REINICIO COMPLETADO ---');
}

reinit();
