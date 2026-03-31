import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    rutasActivas: 0,
    visitasCompletadas: 0,
    choferesRuta: 0
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        const [rutasRes, visitasRes, choferesRes] = await Promise.all([
          supabase.from('rutas').select('*', { count: 'exact', head: true }).in('estado', ['en_progreso', 'pendiente']),
          supabase.from('local_ruta').select('*', { count: 'exact', head: true }).eq('estado_visita', 'visitado'),
          supabase.from('rutas').select('*', { count: 'exact', head: true }).eq('estado', 'en_progreso').not('id_chofer', 'is', null) // Una aproximación de choferes manejando
        ]);

        setStats({
          rutasActivas: rutasRes.count || 0,
          visitasCompletadas: visitasRes.count || 0,
          choferesRuta: choferesRes.count || 0,
        });
      } catch (err) {
        console.error("Error loading stats", err);
      }
    }
    loadConfig();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Panel General</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-surface-light rounded-2xl p-6">
          <h3 className="text-text-muted font-medium mb-2">Rutas Activas</h3>
          <p className="text-4xl font-bold text-white">{stats.rutasActivas}</p>
        </div>
        <div className="bg-surface border border-surface-light rounded-2xl p-6">
          <h3 className="text-text-muted font-medium mb-2">Visitas Completadas</h3>
          <p className="text-4xl font-bold text-green-500">{stats.visitasCompletadas}</p>
        </div>
        <div className="bg-surface border border-surface-light rounded-2xl p-6">
          <h3 className="text-text-muted font-medium mb-2">Choferes en Ruta</h3>
          <p className="text-4xl font-bold text-primary">{stats.choferesRuta}</p>
        </div>
      </div>
    </div>
  );
}
