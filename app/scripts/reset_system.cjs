const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function reset() {
  console.log('--- REINICIANDO SISTEMA Y CONFIGURANDO 4 CHOFERES ---');

  // 1. Limpiar historial
  console.log('Limpiando bitácora, locales y rutas...');
  await supabase.from('viajes_bitacora').delete().neq('id_bitacora', '00000000-0000-0000-0000-000000000000');
  await supabase.from('locales_ruta').delete().neq('id_local_ruta', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rutas').delete().neq('id_ruta', '00000000-0000-0000-0000-000000000000');

  // 2. Configurar 4 Choferes
  console.log('Upserting 4 choferes...');
  
  // Usamos IDs fijos para pruebas si es posible, o actualizamos los que hay
  const choferes = [
    { id: 'da077e98-f24c-45da-9e54-2bd983ebd5ca', nombre: 'Chofer 1', email: 'chofer1@shimaya.com' },
    { id: '2769fdea-680e-4b0f-a278-19e49440ae8a', nombre: 'Chofer 2', email: 'chofer2@shimaya.com' },
    { id: '11111111-1111-1111-1111-111111111111', nombre: 'Chofer 3', email: 'chofer3@shimaya.com' },
    { id: '22222222-2222-2222-2222-222222222222', nombre: 'Chofer 4', email: 'chofer4@shimaya.com' }
  ];

  for (const c of choferes) {
    const { error } = await supabase.from('usuarios').upsert({ 
       id_usuario: c.id,
       nombre: c.nombre,
       email: c.email,
       rol: 'chofer',
       activo: true,
       password: 'shimaya123' 
    }, { onConflict: 'email' });
    
    if (error) console.error(`Error con ${c.nombre}:`, error.message);
  }

  console.log('--- RESET COMPLETADO ---');
  console.log('Credenciales sugeridas (Asegúrate de crearlas en Supabase Auth):');
  console.log('1. chofer1@shimaya.com / shimaya123');
  console.log('2. chofer2@shimaya.com / shimaya123');
  console.log('3. chofer3@shimaya.com / shimaya123');
  console.log('4. chofer4@shimaya.com / shimaya123');
}

reset();
