const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cvbdhjomyywvyqvhrtci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg'
);

async function main() {
  console.log('🔍 Buscando gastos de combustible con fotos...\n');
  
  const { data, error } = await supabase
    .from('gastos_combustible')
    .select('id_gasto, tipo_combustible, monto, foto_url, created_at, usuarios(nombre)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total de gastos: ${data.length}\n`);
  console.log('=== Últimos 20 gastos ===\n');
  
  data.forEach((g, i) => {
    console.log(`${i + 1}. ${g.tipo_combustible?.toUpperCase()} - S/ ${g.monto}`);
    console.log(`   Chofer: ${g.usuarios?.nombre || 'N/A'}`);
    console.log(`   Fecha: ${g.created_at}`);
    console.log(`   Foto: ${g.foto_url ? '✅ SÍ' : '❌ NO'}`);
    if (g.foto_url) {
      console.log(`   URL: ${g.foto_url}`);
    }
    console.log('');
  });

  const conFotos = data.filter(g => g.foto_url).length;
  console.log(`💡 Resumen: ${conFotos} de ${data.length} tienen foto`);
}

main();
