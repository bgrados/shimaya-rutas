const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error("Error fetching usuarios:", error.message);
  } else {
    console.log("Usuarios in table:", data);
  }
}
checkUsers().then(() => console.log('Check complete'));
