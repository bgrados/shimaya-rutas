const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function createGuaranteedAdmin() {
  const email = 'jefe@shimaya.com';
  const password = 'Password123!';

  console.log(`-- Intentando registrar en Supabase Auth: ${email} --`);
  
  // 1. Sign Up the user via public endpoint
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    if (authError.message.includes('already exactly') || authError.message.includes('registered')) {
       console.log("El usuario en Auth ya existe. Procedemos a insertar o actualizar perfil de la base de datos.");
    } else {
       console.error("Error crítico en Auth:", authError);
       return;
    }
  }

  console.log("-- Usuario en Auth creado exitosamente. ID:", authData?.user?.id || "Desconocido --");

  // Nos aseguramos que el ID exista
  let userId = authData?.user?.id;
  
  // Si ya existía y no nos devolvió el ID el signUp, usemos login
  if (!userId) {
     const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
     userId = loginData?.user?.id;
     if (!userId) {
       console.error("Fallo definitivo: Imposible recuperar el ID del usuario de Auth.");
       return;
     }
  }

  // 2. Clear out any existing profiles with this email
  await supabase.from('usuarios').delete().eq('email', email);

  // 3. Insert matching profile
  const { data: insertData, error: insertError } = await supabase.from('usuarios').insert({
    id_usuario: userId,
    nombre: 'Jefe Operaciones',
    email: email,
    rol: 'administrador',
    activo: true
  });

  if (insertError) {
    console.error("-- Error al insertar perfil de admin:", insertError);
    return;
  }

  console.log("\n==================================");
  console.log("✅ NUEVO USUARIO CREADO CON ÉXITO");
  console.log("EMAIL: " + email);
  console.log("PASS:  " + password);
  console.log("==================================\n");
}

createGuaranteedAdmin();
