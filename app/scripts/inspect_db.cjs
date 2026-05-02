const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function inspect() {
  console.log('--- INSPECCIONANDO RUTAS ---');
  const { data, error } = await supabase.from('rutas').select('*').limit(1);
  if (error) {
    console.error('Error rutas:', error);
  } else {
    console.log('Columnas rutas:', Object.keys(data[0] || {}));
  }

  console.log('--- INSPECCIONANDO VIAJES_BITACORA ---');
  const { data: bData, error: bError } = await supabase.from('viajes_bitacora').select('*').limit(1);
  if (bError) {
    console.error('Error bitacora:', bError);
  } else {
    console.log('Columnas bitacora:', Object.keys(bData[0] || {}));
  }

  console.log('--- INSPECCIONANDO LOCALES_RUTA ---');
  const { data: lData, error: lError } = await supabase.from('locales_ruta').select('*').limit(1);
  if (lError) {
    console.error('Error locales_ruta:', lError);
  } else {
    console.log('Columnas locales_ruta:', Object.keys(lData[0] || {}));
  }

  console.log('--- INSPECCIONANDO RUTAS_BASE ---');
  const { data: rbData, error: rbError } = await supabase.from('rutas_base').select('*').limit(1);
  if (rbError) {
    console.error('Error rutas_base:', rbError);
  } else {
    console.log('Columnas rutas_base:', Object.keys(rbData[0] || {}));
  }

  console.log('--- INSPECCIONANDO USUARIOS ---');
  const { data: uData, error: uError } = await supabase.from('usuarios').select('*').limit(1);
  if (uError) {
    console.error('Error usuarios:', uError);
  } else {
    console.log('Columnas usuarios:', Object.keys(uData[0] || {}));
  }
}

inspect();
