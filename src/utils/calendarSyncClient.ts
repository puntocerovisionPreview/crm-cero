import { getAuthHeaders } from './authAccess';

/**
 * Google Calendar desde el navegador: el servidor hace la sincronización (cuenta de servicio).
 * Acá solo se pide que corra ya, sin esperar al reloj de automatizaciones.
 */

export interface CalendarStatus {
  connected: boolean;
  calendarId: string | null;
  serviceAccountEmail: string | null;
  /** Tu cuenta de Google conectada con permiso de Calendar: se puede invitar al cliente */
  invites: boolean;
}

let statusPromise: Promise<CalendarStatus> | null = null;

/** Si el servidor tiene Calendar configurado (se pregunta una vez por sesión) */
export function getCalendarStatus(refresh = false): Promise<CalendarStatus> {
  if (!statusPromise || refresh) {
    statusPromise = (async () => {
      try {
        const headers = await getAuthHeaders();
        const [res, google] = await Promise.all([
          fetch('/api/automation/status', { headers }),
          fetch('/api/drive/status', { headers }).catch(() => null),
        ]);
        const data = res.ok ? await res.json() : null;
        const g = google?.ok ? await google.json() : null;
        return { connected: Boolean(data?.calendar), calendarId: data?.calendarId || null, serviceAccountEmail: data?.serviceAccountEmail || null, invites: Boolean(g?.calendar) };
      } catch {
        return { connected: false, calendarId: null, serviceAccountEmail: null, invites: false };
      }
    })();
  }
  return statusPromise;
}

/** Corre la sincronización ahora. Devuelve un error legible o null si salió bien. */
export async function syncCalendarNow(): Promise<string | null> {
  try {
    const res = await fetch('/api/automation/run', {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ job: 'calendar-sync' }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return data?.error || 'No se pudo sincronizar con Google Calendar.';
    if (data?.skipped) return 'Google Calendar no está conectado en el servidor.';
    return null;
  } catch {
    return 'Sin conexión con el servidor.';
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Después de agendar, mover o borrar una reunión: sincroniza en unos segundos (agrupa cambios seguidos) */
export function requestCalendarSync(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    if ((await getCalendarStatus()).connected) await syncCalendarNow();
  }, 2500);
}
