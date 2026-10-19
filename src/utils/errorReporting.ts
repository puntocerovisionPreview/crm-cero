/**
 * Si una pantalla falla, se guarda en el servidor y te llega un aviso (una vez por día por
 * error). Así no hace falta revisar la app para saber que algo se rompió.
 * Solo con tu sesión iniciada; ignora ruido conocido del navegador.
 */

const IGNORE = [
  /ResizeObserver loop/i,
  /ServiceWorker/i,
  /dev-sw\.js/i,
  /Failed to fetch$/i, // sin conexión
  /NetworkError/i,
  /Load failed/i,
  /AbortError/i,
  /chrome-extension:|moz-extension:/i,
  /Script error\.?$/i,
];

const sent = new Set<string>();
let count = 0;

export function reportError(err: unknown, extra: { componentStack?: string } = {}): void {
  try {
    const e = err as any;
    const message = String(e?.message || e?.reason?.message || e || 'Error desconocido').slice(0, 400);
    const stack = String(e?.stack || '') + (extra.componentStack ? `\n--- componentes ---${extra.componentStack}` : '');
    if (IGNORE.some((r) => r.test(message) || r.test(stack.slice(0, 300)))) return;
    if (sent.has(message) || count >= 10) return;
    sent.add(message);
    count++;
    // se carga recién acá: el portal público del alumno no baja Firebase por esto
    import('./authAccess')
      .then((m) => m.getAuthHeaders())
      .then((headers) => {
        if (!headers.Authorization) return;
        return fetch('/api/health/error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ message, stack: stack.slice(0, 2000), path: window.location.pathname }),
          keepalive: true,
        });
      })
      .catch(() => undefined);
  } catch {
    /* nunca romper por reportar */
  }
}

export function installGlobalErrorReporting(): void {
  if (typeof window === 'undefined' || (window as any).__ceroErrorsInstalled) return;
  (window as any).__ceroErrorsInstalled = true;
  window.addEventListener('error', (ev) => reportError(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
}
