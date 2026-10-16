import { AppDataPayload } from '../types';

export interface VerifyResult {
  success: boolean;
  token?: string;
  locked?: boolean;
  remainingSeconds?: number;
  attemptsLeft?: number;
  error?: string;
}

export interface CloudDataResult {
  success: boolean;
  data?: AppDataPayload;
  initialized?: boolean;
  error?: string;
}

export async function verifyPasscodeOnServer(passcode: string): Promise<VerifyResult> {
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });

    const data = await res.json();
    return {
      success: res.ok && !!data.success,
      token: data.token,
      locked: data.locked,
      remainingSeconds: data.remainingSeconds,
      attemptsLeft: data.attemptsLeft,
      error: data.error,
    };
  } catch (err) {
    console.error('Network error during passcode verification:', err);
    return {
      success: false,
      error: 'Error de conexión con el servidor. Revisa tu internet.',
    };
  }
}

export async function fetchCloudData(token: string): Promise<CloudDataResult> {
  try {
    const res = await fetch('/api/sync', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      return { success: false, error: 'Sesión no válida o expirada' };
    }

    if (!res.ok) {
      return { success: false, error: 'Error del servidor al leer datos' };
    }

    const data = await res.json();
    return {
      success: true,
      initialized: data.initialized,
      data: {
        tasks: data.tasks || [],
        meetings: data.meetings || [],
        projects: data.projects || [],
        incomes: data.incomes || [],
        expenses: data.expenses || [],
        theme: data.theme || 'dark',
        updatedAt: data.updatedAt,
      },
    };
  } catch (err) {
    console.warn('Network error fetching cloud data (using local cache):', err);
    return { success: false, error: 'Sin conexión a internet' };
  }
}

export async function saveCloudData(
  token: string,
  payload: AppDataPayload
): Promise<{ success: boolean; updatedAt?: string; error?: string }> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      return { success: false, error: 'Sesión no válida' };
    }

    if (!res.ok) {
      return { success: false, error: 'Error al sincronizar con el servidor' };
    }

    const data = await res.json();
    return { success: true, updatedAt: data.updatedAt };
  } catch (err) {
    console.warn('Network error pushing to cloud:', err);
    return { success: false, error: 'Sin conexión a internet' };
  }
}

export async function resetCloudDatabase(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/sync/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { success: false, error: 'Error al restablecer datos en el servidor' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error resetting cloud database:', err);
    return { success: false, error: 'Sin conexión a internet' };
  }
}

// Lightweight check for cloud data timestamp
export async function fetchCloudVersion(
  token: string
): Promise<{ success: boolean; updatedAt?: string | null }> {
  try {
    const res = await fetch('/api/sync/version', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { success: false };
    }

    const data = await res.json();
    return { success: true, updatedAt: data.updatedAt || null };
  } catch {
    return { success: false };
  }
}

// Server-Sent Events subscription for instant (<100ms) cross-device synchronization
export function subscribeToCloudEvents(
  token: string,
  deviceId: string,
  onRemoteUpdate: (updatedAt: string, senderDeviceId?: string) => void
): () => void {
  if (typeof window === 'undefined' || !window.EventSource) {
    return () => {};
  }

  let es: EventSource | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;

    try {
      const url = `/api/sync/events?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}`;
      es = new EventSource(url);

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'sync_update' && payload.updatedAt) {
            onRemoteUpdate(payload.updatedAt, payload.senderDeviceId);
          }
        } catch {
          // Ignore keep-alive comments or parse errors
        }
      };

      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (!isClosed && !reconnectTimeout) {
          // Reconnect with backoff
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.warn('Could not establish SSE stream:', err);
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (es) {
      es.close();
      es = null;
    }
  };
}
