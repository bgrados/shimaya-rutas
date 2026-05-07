import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.VITE_SUPABASE_URL) dotenv.config({ path: '.env.example' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kcvdmdjckksjcvguzjox.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'dummy'
);

async function check() {
  const { data, error } = await supabase.from('usuarios').select('email, dias_descanso').eq('email', 'bengrados@gmail.com'); // assuming this is his email, or we'll just fetch all choferes
  console.log("bengrados:", data, error);
  const { data: all } = await supabase.from('usuarios').select('nombre, email, dias_descanso').eq('rol', 'chofer').limit(5);
  console.log("others:", all);
}
check();
