# SHIMAYA RUTAS - Documentación del Proyecto

## Descripción
Aplicación de gestión de rutas de reparto para Shimaya (RUC: 20600603460). Administra rutas diarias, seguimiento GPS en tiempo real, gastos de combustible, y reportes.

## Stack Tecnológico
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Estilos:** Tailwind CSS
- **Mapas:** Leaflet + React-Leaflet
- **PWA:** vite-plugin-pwa (soporte offline)
- **Utilidades:** date-fns, date-fns-tz (zona horaria Perú), Recharts, Tesseract.js (OCR), jsPDF, XLSX

## Estructura de Directorios
```
app/
├── src/
│   ├── components/ui/     # Componentes reutilizables
│   ├── contexts/         # AuthContext
│   ├── hooks/            # useQuery, useDescansoConfirmado
│   ├── layouts/          # AdminLayout, DriverLayout, AuthLayout
│   ├── lib/             # Supabase client, timezone, asistencia, audit
│   ├── pages/
│   │   ├── admin/       # Dashboard, Viajes, Rutas, Usuarios, Combustible, Peaje, Reportes, Análisis, Mapa
│   │   └── driver/      # Dashboard, Viaje, Ruta, Combustible
│   └── types/           # TypeScript types
├── supabase/            # Migraciones y funciones edge
├── scripts/             # Scripts de configuración (.cjs)
└── public/              # Archivos estáticos
```

## Variables de Entorno (.env)
```
VITE_SUPABASE_URL=https://[PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]
VITE_VAPID_PUBLIC_KEY=[VAPID_KEY]
VITE_WHATSAPP_ADMIN=[PHONE]
VITE_WHATSAPP_GROUP=[GROUP_URL]
```

## Despliegue
- **Vercel:** Configurado en vercel.json (build: npm run build, output: dist)
- **GitHub:** Repositorio conectado a Vercel para despliegue automático

## Funcionalidades Principales
### Módulo Chofer
- Registro de viajes con GPS en tiempo real
- Bitácora automática de movimientos
- Registro de gastos de combustible y otros
- Evidencia fotográfica de visitas

### Módulo Administrador
- Dashboard con estadísticas en tiempo real
- Gestión de rutas y plantillas (rutas base)
- Seguimiento en vivo de rutas
- Reportes de combustible, peajes y otros gastos (PDF/Excel)
- Gestión de usuarios (choferes, asistentes, admins)
- Análisis de asistencia mensual

## Notas Importantes
- Zona horaria: America/Lima (UTC-5) - ver src/lib/timezone.ts
- Los peajes se calculan automáticamente desde rutas_base
- Las fotos se guardan con marca de agua automática
- PWA habilitada para uso offline en móviles
