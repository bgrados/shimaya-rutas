import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { AuthLayout } from './layouts/AuthLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DriverLayout } from './layouts/DriverLayout';
import { Spinner } from './components/ui/Spinner';
import { Component, ReactNode } from 'react';

import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import RutasDiarias from './pages/admin/rutas';
import NuevaRuta from './pages/admin/rutas/Nuevo';
import RutasBase from './pages/admin/rutas-base';
import DetalleRutaBase from './pages/admin/rutas-base/Detalle';
import LocalesBase from './pages/admin/locales';
import NuevoLocal from './pages/admin/locales/Nuevo';
import Usuarios from './pages/admin/usuarios';
import NuevoUsuario from './pages/admin/usuarios/Nuevo';
import Reportes from './pages/admin/reportes';
import GastosCombustible from './pages/admin/combustible';
import GastosPeaje from './pages/admin/peaje';
import AdminViajes from './pages/admin/Viajes';
import MapaGeneral from './pages/admin/MapaGeneral';

import DriverDashboard from './pages/driver/Dashboard';
import DriverViaje from './pages/driver/Viaje';
import EjecucionRuta from './pages/driver/ruta';
import VisitaLocal from './pages/driver/ruta/Visita';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          background: '#111', 
          color: '#fff', 
          minHeight: '100vh', 
          padding: '40px 20px',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ color: '#E50914', marginBottom: '20px' }}>Algo salió mal</h1>
          <p style={{ marginBottom: '20px' }}>Ha ocurrido un error inesperado.</p>
          <details style={{ 
            background: '#222', 
            padding: '16px', 
            borderRadius: '8px',
            overflow: 'auto',
            maxHeight: '300px'
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              Ver detalles del error
            </summary>
            <pre style={{ fontSize: '12px', color: '#ccc' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: '#E50914',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
            <Route path="/" element={<AuthLayout />}>
              <Route index element={<Navigate to="/login" replace />} />
              <Route path="login" element={<Login />} />
            </Route>
            
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="viajes" element={<AdminViajes />} />
              <Route path="rutas" element={<RutasDiarias />} />
              <Route path="rutas/nueva" element={<NuevaRuta />} />
              <Route path="rutas-base" element={<RutasBase />} />
              <Route path="rutas-base/:id" element={<DetalleRutaBase />} />
              <Route path="locales" element={<LocalesBase />} />
              <Route path="locales/nuevo" element={<NuevoLocal />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="combustible" element={<GastosCombustible />} />
              <Route path="peaje" element={<GastosPeaje />} />
              <Route path="mapa" element={<MapaGeneral />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="usuarios/nuevo" element={<NuevoUsuario />} />
            </Route>

            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<DriverDashboard />} />
              <Route path="viaje" element={<DriverViaje />} />
              <Route path="ruta/:id" element={<EjecucionRuta />} />
              <Route path="ruta/:rId/visita/:vId" element={<VisitaLocal />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
