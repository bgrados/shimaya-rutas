import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Truck, Users, Fuel, TrendingUp, Clock, CheckCircle, AlertCircle, Eye, Car, Route } from 'lucide-react';

export default function AdminDashboard() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('Iniciando panel de control...');
  const [stats, setStats] = useState({
    rutasActivas: 0,
    totalChoferes: 0,
  });

  useEffect(() => {
    console.log('[AdminDashboard] v6.0 - SIMPLE VERSION');
    loadSimpleData();
  }, []);

  const loadSimpleData = async () => {
    try {
      setDebugInfo('Verificando conexión a Supabase...');
      
      // Test 1: Check if we can connect
      console.log('[AdminDashboard] Testing connection...');
      const { data: testData, error: testError, count } = await supabase
        .from('rutas')
        .select('*', { count: 'exact', head: true });
      
      console.log('[AdminDashboard] Test query result:', { count, error: testError?.message });
      setDebugInfo(`Conexión: ${testError ? 'ERROR' : 'OK'}. Rutas en BD: ${count || 0}`);
      
      if (testError) {
        throw testError;
      }
      
      // Test 2: Count choferes
      const { count: choferesCount, error: choferesError } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('rol', 'chofer');
        
      console.log('[AdminDashboard] Choferes count:', choferesCount, 'error:', choferesError?.message);
      
      setStats({
        rutasActivas: count || 0,
        totalChoferes: choferesCount || 0,
      });
      
      setDebugInfo(`✅ Datos cargados. Rutas: ${count || 0}, Choferes: ${choferesCount || 0}`);
      setLoading(false);
      
    } catch (err: any) {
      console.error('[AdminDashboard] Error:', err);
      setError(`Error: ${err.message}`);
      setDebugInfo(`❌ Error: ${err.message}`);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-4 text-white text-center mt-10">
      <p>Cargando panel de control...</p>
      <p className="text-xs text-text-muted mt-2">{debugInfo}</p>
    </div>
  );

  if (error) return (
    <div className="p-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
        <p className="text-red-400 mb-4">{error}</p>
        <p className="text-xs text-text-muted mb-4">{debugInfo}</p>
        <button onClick={loadSimpleData} className="px-4 py-2 bg-red-500 text-white rounded">
          Reintentar
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Panel de Control - v6.0</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Route className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-blue-300 uppercase font-bold">Rutas en BD</p>
                <p className="text-2xl font-black text-white">{stats.rutasActivas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Users className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-green-300 uppercase font-bold">Choferes</p>
                <p className="text-2xl font-black text-white">{stats.totalChoferes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="bg-surface border border-surface-light rounded-xl p-4 mb-4">
        <h3 className="text-white font-bold mb-2">Estado de carga</h3>
        <p className="text-text-muted text-sm">{debugInfo}</p>
      </div>
    </div>
  );
}
