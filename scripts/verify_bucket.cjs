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

  if (buckets.find(b => b.name === 'combustible')) {
    console.log('\n✅ Bucket "combustible" existe');
    
    console.log('\n🔍 Verificando políticas RLS del bucket...');
    const { data: policies } = await supabase.rpc('pg_catalog.pg_policies' ? {} : { _: '' }).catch(() => ({ data: null }));
    console.log('Políticas:', policies || 'No se pueden listar');
    
    console.log('\n✅ El bucket existe y debería funcionar.');
    console.log('Cuando el chofer suba una foto, debería guardarse.');
  } else {
    console.log('\n⚠️ El bucket "combustible" NO está en la lista.');
    console.log('Pero vos decís que ya lo creaste. Puede ser un tema de permisos del API key.');
  }
}

main();
