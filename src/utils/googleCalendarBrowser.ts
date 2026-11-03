import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../firebaseAuth';
import type { AgendaMeeting } from '../types';

export const GOOGLE_CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GOOGLE_CALENDAR_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export type GoogleCalendarErrorKind =
  | 'popup_blocked'
  | 'permission_denied'
  | 'token_expired'
  | 'api_error';

export interface GoogleCalendarErrorInfo {
  kind: GoogleCalendarErrorKind;
  message: string;
}

type PendingRetryTask = () => Promise<void>;

/**
 * Estado mantenido EXCLUSIVAMENTE en memoria de la sesión actual del navegador.
 * Nunca se persiste en localStorage, sessionStorage ni Firestore.
 */
let memoryAccessToken: string | null = null;
let memoryConnectedAt: number | null = null;
let memoryTokenExpired = false;
let memoryLastError: GoogleCalendarErrorInfo | null = null;
let memoryConnecting = false;
const pendingRetryQueue: PendingRetryTask[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

export interface GoogleCalendarBrowserSnapshot {
  connected: boolean;
  connecting: boolean;
  tokenExpired: boolean;
  connectedAt: number | null;
  error: GoogleCalendarErrorInfo | null;
  pendingCount: number;
}

export function getGoogleCalendarSnapshot(): GoogleCalendarBrowserSnapshot {
  return {
    connected: Boolean(memoryAccessToken) && !memoryTokenExpired,
    connecting: memoryConnecting,
    tokenExpired: memoryTokenExpired,
    connectedAt: memoryConnectedAt,
    error: memoryLastError,
    pendingCount: pendingRetryQueue.length,
  };
}

export function hasGoogleCalendarTokenInMemory(): boolean {
  return Boolean(memoryAccessToken) && !memoryTokenExpired;
}

export function clearGoogleCalendarError(): void {
  memoryLastError = null;
  notifyListeners();
}

export function subscribeGoogleCalendarBrowser(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGoogleCalendarBrowser(): GoogleCalendarBrowserSnapshot {
  const [snap, setSnap] = useState<GoogleCalendarBrowserSnapshot>(() => getGoogleCalendarSnapshot());
  useEffect(() => {
    setSnap(getGoogleCalendarSnapshot());
    return subscribeGoogleCalendarBrowser(() => {
      setSnap(getGoogleCalendarSnapshot());
    });
  }, []);
  return snap;
}

function classifyAuthError(err: unknown): GoogleCalendarErrorInfo {
  const code = String((err as { code?: string })?.code || '');
  const rawMessage = String((err as { message?: string })?.message || '');

  if (code === 'auth/popup-blocked') {
    return {
      kind: 'popup_blocked',
      message:
        'Popup bloqueado por el navegador. Habilitá las ventanas emergentes para este sitio y volvé a tocar "Conectar Google Calendar".',
    };
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled' ||
    code === 'auth/access-denied' ||
    /access_denied|permission|denied|cancel/i.test(rawMessage)
  ) {
    return {
      kind: 'permission_denied',
      message:
        'Permiso rechazado o ventana cerrada antes de autorizar. Tocá "Conectar Google Calendar" y aceptá el acceso a tus eventos.',
    };
  }

  return {
    kind: 'api_error',
    message: `No se pudo completar la conexión con Google Calendar${rawMessage ? ` (${rawMessage})` : ''}.`,
  };
}

/**
 * Pide el permiso https://www.googleapis.com/auth/calendar.events solo cuando el usuario
 * toca "Conectar Google Calendar" o "Reconectar Google Calendar".
 * Si ya hay un usuario autenticado, usa reauthenticateWithPopup o linkWithPopup
 * para no crear una cuenta nueva.
 */
export async function connectGoogleCalendar(): Promise<{
  ok: boolean;
  accessToken?: string;
  error?: GoogleCalendarErrorInfo;
}> {
  memoryConnecting = true;
  memoryLastError = null;
  notifyListeners();

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(GOOGLE_CALENDAR_EVENTS_SCOPE);
    provider.setCustomParameters({
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    const currentUser = auth.currentUser;
    if (currentUser?.email) {
      provider.setCustomParameters({
        prompt: 'consent',
        include_granted_scopes: 'true',
        login_hint: currentUser.email,
      });
    }

    let result: UserCredential;
    if (currentUser) {
      const hasGoogleLinked = currentUser.providerData.some((p) => p.providerId === 'google.com');
      if (hasGoogleLinked) {
        result = await reauthenticateWithPopup(currentUser, provider);
      } else {
        try {
          result = await linkWithPopup(currentUser, provider);
        } catch (linkErr: unknown) {
          const linkCode = String((linkErr as { code?: string })?.code || '');
          if (
            linkCode === 'auth/provider-already-linked' ||
            linkCode === 'auth/credential-already-in-use'
          ) {
            result = await reauthenticateWithPopup(currentUser, provider);
          } else {
            throw linkErr;
          }
        }
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      const denied: GoogleCalendarErrorInfo = {
        kind: 'permission_denied',
        message:
          'Permiso rechazado: Google no devolvió un token de acceso para Calendar. Volvé a conectar y marcá la casilla de permisos de Google Calendar.',
      };
      memoryAccessToken = null;
      memoryLastError = denied;
      memoryConnecting = false;
      notifyListeners();
      return { ok: false, error: denied };
    }

    memoryAccessToken = accessToken;
    memoryConnectedAt = Date.now();
    memoryTokenExpired = false;
    memoryLastError = null;
    memoryConnecting = false;
    notifyListeners();

    // Si había operaciones pendientes por un 401 previo, las ejecutamos ahora sin perder lo que el usuario cargó
    while (pendingRetryQueue.length > 0) {
      const task = pendingRetryQueue.shift();
      if (task) {
        try {
          await task();
        } catch {
          // El propio task maneja su estado de error si vuelve a fallar
        }
      }
    }
    notifyListeners();

    return { ok: true, accessToken };
  } catch (err) {
    const info = classifyAuthError(err);
    memoryLastError = info;
    memoryConnecting = false;
    notifyListeners();
    return { ok: false, error: info };
  }
}

export function disconnectGoogleCalendarMemory(): void {
  memoryAccessToken = null;
  memoryConnectedAt = null;
  memoryTokenExpired = false;
  memoryLastError = null;
  notifyListeners();
}

function toLocalIso(date: string, time: string, offsetMinutes = 0): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1, hh || 0, (mm || 0) + offsetMinutes, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}:00`;
}

function addDaysToDateStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days, 12, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function buildGoogleCalendarEventPayload(meeting: Pick<
  AgendaMeeting,
  'title' | 'date' | 'time' | 'notes' | 'projectName' | 'clientPhone' | 'durationHours' | 'invitados'
>) {
  const descriptionParts = [
    meeting.projectName ? `Cliente / Proyecto: ${meeting.projectName}` : '',
    meeting.clientPhone ? `Tel: ${meeting.clientPhone}` : '',
    meeting.notes || '',
  ].filter(Boolean);

  const summary = meeting.title || 'Reunión';
  const description = descriptionParts.join('\n');

  const attendees =
    Array.isArray(meeting.invitados) && meeting.invitados.length > 0
      ? meeting.invitados
          .map((email) => email.trim().toLowerCase())
          .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          .map((email) => ({ email }))
      : undefined;

  if (meeting.time && /^\d{2}:\d{2}$/.test(meeting.time)) {
    const durationMinutes = Math.max(15, Math.round((meeting.durationHours || 1) * 60));
    return {
      summary,
      description,
      start: {
        dateTime: toLocalIso(meeting.date, meeting.time, 0),
        timeZone: DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: toLocalIso(meeting.date, meeting.time, durationMinutes),
        timeZone: DEFAULT_TIMEZONE,
      },
      ...(attendees ? { attendees } : {}),
    };
  }

  return {
    summary,
    description,
    start: { date: meeting.date },
    end: { date: addDaysToDateStr(meeting.date, 1) },
    ...(attendees ? { attendees } : {}),
  };
}

async function calendarFetch(
  url: string,
  init: RequestInit,
  onRetryAfterReconnect?: PendingRetryTask
): Promise<{ ok: boolean; status: number; data?: any; error?: GoogleCalendarErrorInfo }> {
  if (!memoryAccessToken) {
    const expiredErr: GoogleCalendarErrorInfo = {
      kind: 'token_expired',
      message: 'Token vencido o no conectado. Tocá "Reconectar Google Calendar" para sincronizar sin perder lo cargado.',
    };
    memoryTokenExpired = true;
    memoryLastError = expiredErr;
    if (onRetryAfterReconnect) {
      pendingRetryQueue.push(onRetryAfterReconnect);
    }
    notifyListeners();
    return { ok: false, status: 401, error: expiredErr };
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${memoryAccessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    if (response.status === 401) {
      memoryAccessToken = null;
      memoryTokenExpired = true;
      const expiredErr: GoogleCalendarErrorInfo = {
        kind: 'token_expired',
        message:
          'El token de Google Calendar venció (dura ~1 hora). Tocá "Reconectar Google Calendar" para continuar sin perder lo que estabas cargando.',
      };
      memoryLastError = expiredErr;
      if (onRetryAfterReconnect) {
        pendingRetryQueue.push(onRetryAfterReconnect);
      }
      notifyListeners();
      return { ok: false, status: 401, error: expiredErr };
    }

    if (response.status === 403) {
      const errBody = await response.json().catch(() => ({}));
      const detail = errBody?.error?.message || 'Permiso insuficiente para Google Calendar';
      const permErr: GoogleCalendarErrorInfo = {
        kind: 'permission_denied',
        message: `Permiso rechazado por Google Calendar: ${detail}. Reconectá y aceptá los permisos de eventos.`,
      };
      memoryLastError = permErr;
      notifyListeners();
      return { ok: false, status: 403, error: permErr };
    }

    if (response.status === 204 || response.status === 410) {
      memoryLastError = null;
      notifyListeners();
      return { ok: true, status: response.status };
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || `HTTP ${response.status}`;
      const apiErr: GoogleCalendarErrorInfo = {
        kind: 'api_error',
        message: `Fallo de la API de Google Calendar: ${detail}.`,
      };
      memoryLastError = apiErr;
      notifyListeners();
      return { ok: false, status: response.status, error: apiErr };
    }

    memoryLastError = null;
    notifyListeners();
    return { ok: true, status: response.status, data };
  } catch (networkErr) {
    const apiErr: GoogleCalendarErrorInfo = {
      kind: 'api_error',
      message: `Fallo de la API de Google Calendar (red): ${(networkErr as Error)?.message || 'Sin conexión'}.`,
    };
    memoryLastError = apiErr;
    notifyListeners();
    return { ok: false, status: 0, error: apiErr };
  }
}

/**
 * Crea un evento en Google Calendar (POST https://www.googleapis.com/calendar/v3/calendars/primary/events)
 */
export async function createGoogleCalendarEventInBrowser(
  meeting: AgendaMeeting,
  onCreatedId?: (googleEventId: string) => void
): Promise<{ ok: boolean; googleEventId?: string; error?: GoogleCalendarErrorInfo }> {
  if (meeting.proposed) return { ok: true };

  const runCreate = async () => {
    const res = await calendarFetch(GOOGLE_CALENDAR_EVENTS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(buildGoogleCalendarEventPayload(meeting)),
    });
    if (res.ok && res.data?.id && onCreatedId) {
      onCreatedId(String(res.data.id));
    }
  };

  const res = await calendarFetch(
    GOOGLE_CALENDAR_EVENTS_ENDPOINT,
    {
      method: 'POST',
      body: JSON.stringify(buildGoogleCalendarEventPayload(meeting)),
    },
    runCreate
  );

  if (res.ok && res.data?.id) {
    const eventId = String(res.data.id);
    onCreatedId?.(eventId);
    return { ok: true, googleEventId: eventId };
  }

  return { ok: false, error: res.error };
}

/**
 * Edita un evento existente en Google Calendar (PATCH .../events/{eventId})
 * Si la reunión aún no tenía googleEventId, lo crea automáticamente con POST.
 */
export async function updateGoogleCalendarEventInBrowser(
  meeting: AgendaMeeting,
  onCreatedId?: (googleEventId: string) => void
): Promise<{ ok: boolean; googleEventId?: string; error?: GoogleCalendarErrorInfo }> {
  if (meeting.proposed) return { ok: true };

  if (!meeting.googleEventId) {
    return createGoogleCalendarEventInBrowser(meeting, onCreatedId);
  }

  const eventUrl = `${GOOGLE_CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(meeting.googleEventId)}`;
  const runUpdate = async () => {
    await calendarFetch(eventUrl, {
      method: 'PATCH',
      body: JSON.stringify(buildGoogleCalendarEventPayload(meeting)),
    });
  };

  const res = await calendarFetch(
    eventUrl,
    {
      method: 'PATCH',
      body: JSON.stringify(buildGoogleCalendarEventPayload(meeting)),
    },
    runUpdate
  );

  if (res.status === 404) {
    // Si el evento fue borrado en Google Calendar, lo volvemos a crear
    return createGoogleCalendarEventInBrowser({ ...meeting, googleEventId: undefined }, onCreatedId);
  }

  return { ok: res.ok, googleEventId: meeting.googleEventId, error: res.error };
}

/**
 * Borra un evento en Google Calendar (DELETE .../events/{eventId})
 */
export async function deleteGoogleCalendarEventInBrowser(
  googleEventId?: string
): Promise<{ ok: boolean; error?: GoogleCalendarErrorInfo }> {
  if (!googleEventId) return { ok: true };

  const eventUrl = `${GOOGLE_CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(googleEventId)}`;
  const runDelete = async () => {
    await calendarFetch(eventUrl, { method: 'DELETE' });
  };

  const res = await calendarFetch(
    eventUrl,
    { method: 'DELETE' },
    runDelete
  );

  if (res.status === 404 || res.status === 410) {
    return { ok: true };
  }

  return { ok: res.ok, error: res.error };
}
