import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DriverLayout } from './layouts/DriverLayout';
import { Component, ReactNode, Suspense, lazy } from 'react';

import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import RutasDiarias from './pages/admin/rutas';
import NuevaRuta from './pages/admin/rutas/Nuevo';
import RutasBase from './pages/admin/rutas-base';
import DetalleRutaBase from './pages/admin/rutas-base/Detalle';
import Reportes from './pages/admin/reportes';
import GastosCombustible from './pages/admin/combustible';
import AdminViajes from './pages/admin/Viajes';
import Usuarios from './pages/admin/usuarios';
import NuevoUsuario from './pages/admin/usuarios/Nuevo';

import DriverDashboard from './pages/driver/Dashboard';
import DriverViaje from './pages/driver/Viaje';
import EjecucionRuta from './pages/driver/ruta';
import VisitaLocal from './pages/driver/ruta/Visita';

// Lazy load para componentes con Leaflet
const MapaGeneral = lazy(() => import('./pages/admin/MapaGeneral'));
const LocalesBaseLazy = lazy(() => import('./pages/admin/locales'));
const NuevoLocalLazy = lazy(() => import('./pages/admin/locales/Nuevo'));

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

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
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
              <Route path="locales" element={
                <Suspense fallback={<div className="p-4 text-white">Cargando...</div>}>
                  <LocalesBaseLazy />
                </Suspense>
              } />
              <Route path="locales/nuevo" element={
                <Suspense fallback={<div className="p-4 text-white">Cargando...</div>}>
                  <NuevoLocalLazy />
                </Suspense>
              } />
              <Route path="reportes" element={<Reportes />} />
              <Route path="combustible" element={<GastosCombustible />} />
              <Route path="mapa" element={
                <Suspense fallback={<div className="p-4 text-white">Cargando...</div>}>
                  <MapaGeneral />
                </Suspense>
              } />
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
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
