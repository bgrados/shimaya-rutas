const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

// Usuarios con sus contraseñas reales de la tabla
const users = [
  { email: 'admin@shimaya.com',   password: '2222222',   nombre: 'Admin Prueba' },
  { email: 'jefe@shimaya.com',    password: 'Shimaya2025!', nombre: 'Jefe Operaciones' },
  { email: 'benja@shimaya.com',   password: 'shimaya123', nombre: 'Chofer 1 (Benja)' },
  { email: 'chofer@shimaya.com',  password: 'shimaya123', nombre: 'Chofer 2' },
  { email: 'chofer3@shimaya.com', password: 'shimaya123', nombre: 'Chofer 3' },
  { email: 'chofer4@shimaya.com', password: 'shimaya123', nombre: 'Chofer 4' },
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function setupUsers() {
  console.log('=== CREANDO USUARIOS EN SUPABASE AUTH ===\n');

  for (const u of users) {
    console.log(`→ ${u.email} (${u.nombre})...`);

    // Intentar signUp primero
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')) {
        // Ya existe en Auth, intentar login para confirmar
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: u.email,
          password: u.password,
        });
        if (loginErr) {
          console.log(`  ⚠️  Ya existe pero contraseña incorrecta: ${loginErr.message}`);
        } else {
          console.log(`  ✅ Ya existía y credenciales OK`);
          await supabase.auth.signOut();
        }
      } else {
        console.log(`  ❌ Error: ${error.message}`);
      }
    } else if (data.user) {
      if (data.user.confirmed_at || data.session) {
        console.log(`  ✅ Creado y activo (ID: ${data.user.id})`);
      } else {
        console.log(`  📧 Creado — pendiente confirmación de email (ID: ${data.user.id})`);
        console.log(`     ⚠️  Ve a Supabase → Authentication → Users → confirmar manualmente`);
      }
    }

    await sleep(500); // Evitar rate limiting
  }

  console.log('\n=== VERIFICANDO LOGINS ===\n');

  for (const u of users) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });

    if (error) {
      console.log(`❌ ${u.email}: ${error.message}`);
    } else {
      console.log(`✅ ${u.email}: LOGIN OK`);
      await supabase.auth.signOut();
    }
    await sleep(300);
  }

  console.log('\n=== LISTO ===');
  console.log('\nSi ves "📧 pendiente confirmación", ve a:');
  console.log('Supabase Dashboard → Authentication → Users → click en el usuario → "Confirm user"');
}

setupUsers().catch(console.error);
