import React from 'react';

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Panel General</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-surface-light rounded-2xl p-6">
          <h3 className="text-text-muted font-medium mb-2">Rutas Activas</h3>
          <p className="text-4xl font-bold text-white">0</p>
        </div>
        <div className="bg-surface border border-surface-light rounded-2xl p-6">
          <h3 className="text-text-muted font-medium mb-2">Visitas Completadas</h3>
          <p className="text-4xl font-bold text-green-500">0</p>
        </div>
        <div className="bg-surface border border-surface-light rounded-2xl p-6">
          <h3 className="text-text-muted font-medium mb-2">Choferes en Ruta</h3>
          <p className="text-4xl font-bold text-primary">0</p>
        </div>
      </div>
    </div>
  );
}
