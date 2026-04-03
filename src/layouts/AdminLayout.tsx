import React, { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, Users, Settings, LogOut, Menu, X, LayoutDashboard, MapPin, BarChart3, Truck } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-center">
        {/* Tu código original del spinner aquí */}
      </div>
    );
  }

  if (!loading && (!user || !profile || profile.rol !== 'administrador')) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) return null;
  
  // ... resto de tu navegación original
  return (
    // ... tu JSX original
  );
};
