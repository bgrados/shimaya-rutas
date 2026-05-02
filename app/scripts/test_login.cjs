const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@shimaya.com',
    password: '2222222'
  });
  
  if (error) {
    console.log("SignIn Error:", error.message);
  } else {
    console.log("✅ Logged in! Auth ID:", data?.user?.id);
    
    // Test profile lookup by email (how AuthContext does it)
    const { data: pfEmail, error: errEmail } = await supabase.from('usuarios').select('*').eq('email', 'admin@shimaya.com').single();
    console.log("Profile by email:", pfEmail || errEmail);
  }
}
test();
