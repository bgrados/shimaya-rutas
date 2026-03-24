const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertBenja() {
  const { data, error } = await supabase.from('usuarios').insert({
    id_usuario: 'da077e98-f24c-45da-9e54-2bd983ebd5ca',
    email: 'benja@shimaya.com',
    nombre: 'Benjamin',
    rol: 'administrador',
    activo: true
  });
  
  if (error) {
    console.error("Error al insertar:", error.message);
  } else {
    console.log("¡Usuario Benja insertado correctamente!");
  }
}
insertBenja();
