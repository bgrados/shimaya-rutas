const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  console.log('=== BUSCAR PLANTA ===');
  const { data: planta } = await supabase.from('locales_base').select('*').ilike('nombre', '%planta%');
  console.log('Planta:', planta);
  
  console.log('\n=== LOCALES SIN RUTA ===');
  const { data: sinRuta } = await supabase.from('locales_base').select('*').is('id_ruta_base', null);
  console.log('Sin ruta:', sinRuta?.map(l => ({ nombre: l.nombre, latitud: l.latitud, longitud: l.longitud })));
}

check();
