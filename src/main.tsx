import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Recargar?')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        reg.update().then(() => {
          console.log('SW updated');
        });
      }
    });
  });
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
