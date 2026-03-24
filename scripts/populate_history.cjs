const { createClient } = require('@supabase/supabase-js');

const URL = 'https://cvbdhjomyywvyqvhrtci.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmRoam9teXl3dnlxdmhydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDUyOTQsImV4cCI6MjA4OTI4MTI5NH0.30RyLciUKl7MXZ_9NqjXq2ppUDoTmz7ldgw9-spSlzg';

const supabase = createClient(URL, KEY);

async function populate() {
  console.log('--- POBLANDO HISTORIAL DE VIAJES (CON COLORES) ---');

  const drivers = [
    { id: 'da077e98-f24c-45da-9e54-2bd983ebd5ca', name: 'Benjamin' },
    { id: '2769fdea-680e-4b0f-a278-19e49440ae8a', name: 'Chofer Prueba' }
  ];

  const routes = [
    { name: 'Ruta Negra - Norte', placa: 'ABC-123' },
    { name: 'Ruta Guinda - Sur', placa: 'XYZ-987' },
    { name: 'Ruta Verde - Este', placa: 'DEF-456' },
    { name: 'Ruta Amarilla - Oeste', placa: 'GHI-789' }
  ];

  const daysOffsets = [0, -1, -2];

  for (const driver of drivers) {
    console.log(`--- POBLANDO PARA ${driver.name} ---`);
    for (const offset of daysOffsets) {
      for (const rTemplate of routes) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const dateStr = date.toISOString().split('T')[0];

        // Randomly pick unique route name per day
        const name = `${rTemplate.name} (${driver.name})`;
        
        console.log(`Creando ${name} para ${dateStr}...`);

        const { data: route, error: routeError } = await supabase.from('rutas').insert({
          nombre: name,
          fecha: dateStr,
          id_chofer: driver.id,
          estado: 'finalizada',
          placa: rTemplate.placa,
          hora_salida_planta: new Date(date.setHours(8, 0, 0)).toISOString(),
          hora_llegada_planta: new Date(date.setHours(14, 0, 0)).toISOString()
        }).select().single();

        if (routeError) {
          console.error('Error insertando ruta:', routeError.message);
          continue;
        }

        const localesNames = ['Local Miraflores', 'Local San Isidro', 'Local Barranco'];
        for (let i = 0; i < localesNames.length; i++) {
            await supabase.from('locales_ruta').insert({
                id_ruta: route.id_ruta,
                nombre: localesNames[i],
                orden: i + 1,
                estado_visita: 'visitado'
            });
        }

        const stops = [
          { from: 'Planta', to: localesNames[0], start: 8.5, end: 9.5 },
          { from: localesNames[0], to: localesNames[1], start: 10, end: 11 },
          { from: localesNames[1], to: localesNames[2], start: 11.5, end: 12.5 },
          { from: localesNames[2], to: 'Planta', start: 13, end: 14 }
        ];

        for (const stop of stops) {
          const startH = new Date(date); startH.setHours(Math.floor(stop.start), (stop.start % 1) * 60, 0);
          const endH = new Date(date); endH.setHours(Math.floor(stop.end), (stop.end % 1) * 60, 0);

          const isoStart = startH.toISOString();
          const isoEnd = endH.toISOString();

          await supabase.from('viajes_bitacora').insert({
            id_ruta: route.id_ruta,
            id_chofer: driver.id,
            origen_nombre: stop.from,
            destino_nombre: stop.to,
            hora_salida: isoStart,
            hora_llegada: isoEnd
          });

          if (stop.from !== 'Planta') {
             await supabase.from('locales_ruta').update({ hora_salida: isoStart }).eq('id_ruta', route.id_ruta).eq('nombre', stop.from);
          }
          if (stop.to !== 'Planta') {
             await supabase.from('locales_ruta').update({ hora_llegada: isoEnd }).eq('id_ruta', route.id_ruta).eq('nombre', stop.to);
          }
        }
      }
    }
  }

  console.log('--- PROCESO COMPLETADO ---');
}

populate();
