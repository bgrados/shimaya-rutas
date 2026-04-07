const { createClient } = require('@supabase/supabase-js');
const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTE3NzgwMCwiZXhwIjo0ODk2NzU1ODAwfQ.Yf4j1gS6M7n7w2G5uB1v4P7k8R9Y3M0D5H2Z6e9T0Sg';
const supabase = createClient(URL, KEY);

async function main() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: 'ALTER TABLE locales_ruta ADD COLUMN IF NOT EXISTS fotos_evidencia TEXT[];'
  });
  
  if (error) {
    console.error('Error adding column:', error);
  } else {
    console.log('Column added successfully:', data);
  }
}
main();
