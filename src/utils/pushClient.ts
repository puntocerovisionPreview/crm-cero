import { getAuthHeaders } from './authAccess';

// Activar / desactivar notificaciones push en ESTE dispositivo

export type PushSupport = 'ok' | 'no-soportado' | 'ios-sin-instalar' | 'bloqueado';

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'no-soportado';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  // En iPhone/iPad, el navegador solo permite push con la app agregada a la pantalla de inicio
  if (isIos && !standalone) return 'ios-sin-instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  return 'ok';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/mac/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Dispositivo';
}

const ON_KEY = 'cero_push_on';
const setOn = (on: boolean) => { try { on ? localStorage.setItem(ON_KEY, '1') : localStorage.removeItem(ON_KEY); } catch { /* sin almacenamiento */ } };
const wasOn = () => { try { return localStorage.getItem(ON_KEY) === '1'; } catch { return false; } };

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const actual = sub.options?.applicationServerKey;
  if (!actual) return true; // el navegador no lo informa: no se toca
  const a = new Uint8Array(actual);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

/** Deja este dispositivo suscripto con las claves actuales del servidor y anotado en la base */
async function ensureSubscribed(): Promise<void> {
  const { publicKey } = await api('/api/push/public-key');
  const key = urlBase64ToUint8Array(publicKey);
  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  // Suscripción hecha con claves viejas: no llega nada. Se rehace.
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }
  if (!subscription) subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api('/api/push/subscribe', { subscription: subscription.toJSON(), label: deviceLabel() });
  setOn(true);
}

export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No diste permiso para notificaciones. Podés habilitarlo en la configuración del navegador.');
  await ensureSubscribed();
}

/**
 * Al abrir la app: si este dispositivo tenía los avisos activados, se asegura de que sigan
 * andando (el navegador a veces vence la suscripción, o el servidor la perdió). No pide permiso
 * ni molesta: solo repara lo que ya habías activado.
 */
export async function repairPush(): Promise<void> {
  try {
    if (getPushSupport() !== 'ok' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const existing = reg ? await reg.pushManager.getSubscription() : null;
    if (!existing && !wasOn()) return; // nunca los activó acá
    await ensureSubscribed();
  } catch { /* se reintenta la próxima vez que abras la app */ }
}

export async function disablePush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  setOn(false);
  await api('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<number> {
  const r = await api('/api/push/test', {});
  return r.delivered ?? 0;
}
