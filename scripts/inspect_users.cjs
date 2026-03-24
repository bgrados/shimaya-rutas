const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function inspect() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  console.log('--- USUARIOS EN TABLA ---');
  data?.forEach(u => {
    console.log(`- Nombre: ${u.nombre}, Email: ${u.email}, Rol: ${u.rol}`);
  });
}

inspect();
