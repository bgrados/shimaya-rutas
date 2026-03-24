const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function run() {
  console.log('--- AGREGANDO COLUMNA PLACA ---');
  // Nota: No se puede agregar columnas vía JS SDK directamente si hay RLS o restricciones de DDL.
  // Pero intentaremos insertar directamente si ya existe, o dar un error claro.
  
  const choferId = '2769fdea-680e-4b0f-a278-19e49440ae8a'; // Chofer Prueba
  const benjaId = 'da077e98-f24c-45da-9e54-2bd983ebd5ca'; // Benjamin
  
  console.log('--- INSERTANDO RUTA FICTICIA ---');
  const { data: route, error: routeError } = await supabase.from('rutas').insert({
    nombre: 'Ruta de Prueba - Centro',
    fecha: new Date().toISOString().split('T')[0],
    id_chofer: benjaId, // Para que Benja la vea
    estado: 'pendiente'
  }).select().single();
  
  if (routeError) {
    console.error('Error al insertar ruta:', routeError);
    return;
  }
  
  console.log('Ruta creada:', route.id_ruta);
  
  console.log('--- INSERTANDO TRAMO INICIAL ---');
  const { error: bitacoraError } = await supabase.from('viajes_bitacora').insert({
    id_ruta: route.id_ruta,
    origen_nombre: 'Planta',
    destino_nombre: 'Local Miraflores',
    hora_salida: new Date().toISOString()
  });
  
  if (bitacoraError) {
    console.error('Error al insertar bitácora:', bitacoraError);
  } else {
    console.log('Bitácora inicial creada exitosamente.');
  }
}

run();
