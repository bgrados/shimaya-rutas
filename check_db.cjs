const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function check() {
  console.log('=== COLUMNAS DE locales_base ===');
  const { data: cols } = await supabase.from('locales_base').select('*').limit(1);
  console.log('Columnas:', cols ? Object.keys(cols[0]) : 'error');
  
  console.log('\n=== ALGUNOS LOCALES ===');
  const { data: locales } = await supabase.from('locales_base').select('*').limit(3);
  console.log('Locales:', locales?.map(l => ({ nombre: l.nombre, foto_url: l.foto_url })));
  
  console.log('\n=== PROBAR STORAGE ===');
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Buckets:', buckets?.map(b => b.name) || 'vacío');
  } catch(e) {
    console.log('Error storage:', e.message);
  }
}

check();
