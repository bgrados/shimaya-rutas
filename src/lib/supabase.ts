import { createClient } from '@supabase/supabase-js'



const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

ok te voy pasando uno por uno hasta q termine de pasarte no me des respuesta si necesitas adicional me avisas

if (!supabaseUrl || !supabaseKey) {

  console.error('Missing Supabase environment variables');

}



export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder')
