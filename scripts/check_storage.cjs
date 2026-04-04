const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cvbdhjomyywvyqvhrtci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg'
);

async function main() {
  console.log('🔍 Verificando buckets de storage...\n');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Buckets disponibles:');
  buckets.forEach(b => {
    console.log(`  - ${b.name} (public: ${b.public})`);
  });

  const tieneCombustible = buckets.find(b => b.name === 'combustible');
  if (!tieneCombustible) {
    console.log('\n⚠️ El bucket "combustible" NO existe. Necesitas crearlo.');
  } else {
    console.log('\n✅ El bucket "combustible" existe');
  }
}

main();
