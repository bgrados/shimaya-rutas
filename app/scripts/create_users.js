import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUsers() {
  console.log('Creating Admin...');
  const adminRes = await supabase.auth.signUp({
    email: 'admin@shimaya.com',
    password: 'password123',
    options: {
      data: {
        nombre: 'Admin Prueba',
        rol: 'administrador'
      }
    }
  });
  
  if (adminRes.error) {
    console.error("Admin signUp error:", adminRes.error);
  } else {
    console.log("Admin auth created:", adminRes.data?.user?.id);
    const id = adminRes.data?.user?.id;
    if (id) {
      const addAdmin = await supabase.from('usuarios').insert({
        id_usuario: id,
        nombre: 'Admin Prueba',
        email: 'admin@shimaya.com',
        rol: 'administrador',
        activo: true
      });
      console.log("Admin table insert (if any error):", addAdmin.error || "Success");
    }
  }

  console.log('\nCreating Chofer...');
  const choferRes = await supabase.auth.signUp({
    email: 'chofer@shimaya.com',
    password: 'password123',
    options: {
      data: {
        nombre: 'Chofer Prueba',
        rol: 'chofer'
      }
    }
  });

  if (choferRes.error) {
    console.error("Chofer signUp error:", choferRes.error);
  } else {
    console.log("Chofer auth created:", choferRes.data?.user?.id);
    const id = choferRes.data?.user?.id;
    if (id) {
      const addChofer = await supabase.from('usuarios').insert({
        id_usuario: id,
        nombre: 'Chofer Prueba',
        email: 'chofer@shimaya.com',
        rol: 'chofer',
        activo: true
      });
      console.log("Chofer table insert (if any error):", addChofer.error || "Success");
    }
  }
}

createUsers().then(() => console.log('Done'));
