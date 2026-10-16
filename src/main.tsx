import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentPortalView } from './views/StudentPortalView';
import './index.css';

// El portal del alumno es público: se muestra solo, sin PIN ni el resto del CRM
const portalMatch = window.location.pathname.match(/^\/alumno\/([^/?#]+)/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {portalMatch ? <StudentPortalView token={portalMatch[1]} /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);

