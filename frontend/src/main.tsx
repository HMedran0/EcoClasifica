import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initAuth } from './features/auth/authStore';
import { listenForInstallPrompt } from './pwa/installPrompt';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root en index.html');

// Antes de renderizar: Chrome puede emitir beforeinstallprompt muy pronto.
listenForInstallPrompt();
// Antes de renderizar: carga la sesión guardada y canjea el `?code=` al volver de Google o del correo.
initAuth();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
