import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { installGlobalErrorReporting } from './utils/errorReporting';

// Errores de las pantallas: se guardan y te avisan (ver Ajustes → Estado de la app)
installGlobalErrorReporting();

// El portal del alumno es público: se muestra solo, sin el resto del CRM.
// Cada uno se descarga por separado: un alumno nunca baja el código del CRM.
const App = lazy(() => import('./App.tsx'));
const StudentPortalView = lazy(() => import('./views/StudentPortalView').then((m) => ({ default: m.StudentPortalView })));
const DocumentPublicView = lazy(() => import('./views/DocumentPublicView'));
const ClientPanelView = lazy(() => import('./views/ClientPanelView').then((m) => ({ default: m.ClientPanelView })));

// Red de seguridad para las animaciones entre pantallas: si el navegador no está dibujando
// (pestaña o app en segundo plano), la animación esperaría para siempre y la pantalla quedaría
// trabada. Si no termina en 1 segundo, se saltea y el cambio de pantalla ocurre igual.
if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
  const original = document.startViewTransition.bind(document);
  (document as any).startViewTransition = (arg: any) => {
    const transition = original(arg);
    const timer = setTimeout(() => {
      try {
        transition.skipTransition();
      } catch {
        // ya terminó
      }
    }, 1000);
    transition.finished.finally(() => clearTimeout(timer)).catch(() => {});
    return transition;
  };
}

const portalMatch = window.location.pathname.match(/^\/alumno\/([^/?#]+)/);
// Presupuestos y recibos con link: también públicos y sin el resto del CRM
const docMatch = window.location.pathname.match(/^\/doc\/([^/?#]+)/);
// Panel del cliente: objetivos, tareas y contenido para aprobar (público, por link)
const panelMatch = window.location.pathname.match(/^\/panel\/([^/?#]+)/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="fixed inset-0 bg-[var(--bg-app)]" />}>
        {portalMatch ? (
          <StudentPortalView token={portalMatch[1]} />
        ) : docMatch ? (
          <DocumentPublicView token={docMatch[1]} />
        ) : panelMatch ? (
          <ClientPanelView token={panelMatch[1]} />
        ) : (
          <App />
        )}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
