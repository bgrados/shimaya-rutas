const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUsers() {
  console.log('Creating Admin...');
  const adminRes = await supabase.auth.signUp({
    email: 'admin@shimaya.com',
    password: 'password123'
  });
  if (adminRes.error) console.error("Admin error:", adminRes.error.message);
  else {
    console.log("Admin ID:", adminRes.data?.user?.id);
    if (adminRes.data?.user?.id) {
        const id = adminRes.data.user.id;
        const addAdmin = await supabase.from('usuarios').insert({ id_usuario: id, nombre: 'Admin Prueba', email: 'admin@shimaya.com', rol: 'administrador', activo: true });
        console.log("Admin insert:", addAdmin.error?.message || "Success");
    }
  }

  console.log('\nWait 15s for rate limits...');
  await new Promise(r => setTimeout(r, 15000));
  console.log('Creating Chofer...');
  const choferRes = await supabase.auth.signUp({
    email: 'chofer@shimaya.com',
    password: 'password123'
  });
  if (choferRes.error) console.error("Chofer error:", choferRes.error.message);
  else {
    console.log("Chofer ID:", choferRes.data?.user?.id);
    if (choferRes.data?.user?.id) {
        const id = choferRes.data.user.id;
        const addChofer = await supabase.from('usuarios').insert({ id_usuario: id, nombre: 'Chofer Prueba', email: 'chofer@shimaya.com', rol: 'chofer', activo: true });
        console.log("Chofer insert:", addChofer.error?.message || "Success");
    }
  }
}
createUsers().then(() => console.log('Done'));
