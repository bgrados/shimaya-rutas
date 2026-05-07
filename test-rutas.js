import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.VITE_SUPABASE_URL) dotenv.config({ path: '.env.example' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kcvdmdjckksjcvguzjox.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'dummy'
);

async function check() {
  const { data, error } = await supabase.from('rutas_base').select('*').eq('activa', true);
  console.log("rutas activas true:", data?.length, error);
  const { data: d2 } = await supabase.from('rutas_base').select('*').eq('activa', 'true');
  console.log("rutas activas 'true':", d2?.length);
  const { data: d3 } = await supabase.from('rutas_base').select('*');
  console.log("todas las rutas_base:", d3?.length);
}
check();
