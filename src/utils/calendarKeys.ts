/**
 * Huellas de una reunión en Google Calendar. Las usan el servidor y el navegador: si las dos
 * coinciden con lo guardado, la sincronización no vuelve a escribir el evento (ni a mandarle
 * otro correo al cliente).
 */

export function meetingHash(m: { title: string; date: string; time?: string; durationHours?: number }): string {
  return [m.title || '', m.date || '', m.time || '', m.durationHours || 1].join('|');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Invitados válidos y ordenados: también sirve de huella para saber si ya se mandó */
export function inviteKey(m: { invitados?: string[] }): string {
  return [...new Set((m.invitados || []).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))].sort().join(',');
}
