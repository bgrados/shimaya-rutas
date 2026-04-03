import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';

import { AuthLayout } from './layouts/AuthLayout';

import { AdminLayout } from './layouts/AdminLayout';

import { DriverLayout } from './layouts/DriverLayout';



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

import AdminViajes from './pages/admin/Viajes';

import MapaGeneral from './pages/admin/MapaGeneral';



import DriverDashboard from './pages/driver/Dashboard';

import DriverViaje from './pages/driver/Viaje';

import EjecucionRuta from './pages/driver/ruta';

import VisitaLocal from './pages/driver/ruta/Visita';



function App() {

  return (

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

            <Route path="locales" element={<LocalesBase />} />

            <Route path="locales/nuevo" element={<NuevoLocal />} />

            <Route path="reportes" element={<Reportes />} />

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

      </BrowserRouter>

    </AuthProvider>

  );

}



export default App;
