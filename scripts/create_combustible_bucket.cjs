const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cvbdhjomyywvyqvhrtci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg'
);

async function main() {
  console.log('🔧 Creando bucket "combustible"...\n');
  
  const { data, error } = await supabase.storage.createBucket('combustible', {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  });
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('✅ Bucket "combustible" creado correctamente');
}

main();
