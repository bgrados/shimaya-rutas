import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Limpiar service workers y caches viejos que puedan bloquear la app
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(sw => sw.unregister())
  })
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="color:red;padding:20px">Error: #root element not found</div>'
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (err) {
    rootEl.innerHTML = `<div style="color:red;background:#111;padding:20px;font-family:monospace">
      <h2>Error al iniciar la app:</h2>
      <pre>${String(err)}</pre>
    </div>`
    console.error('Fatal render error:', err)
  }
}
