import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AnalisisRutas() {
  const [data, setData] = useState(null);

  useEffect(() => {
    supabase.from('rutas').select('*').limit(5).then(res => {
      console.log('DATOS:', res.data);
      setData(res.data);
    });
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-white text-xl">Prueba Análisis</h1>
      <pre className="text-white text-xs mt-4">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
