const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('rutas').select('*').limit(1);
  if (data && data.length > 0) {
    console.log("Columnas en rutas:", Object.keys(data[0]));
  } else {
    console.log("No hay rutas para inspeccionar, intentando ver el objeto de error o null", error);
  }
}
inspect();
