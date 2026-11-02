/**
 * PORTAL DEL CLIENTE PAF (con cuenta de Google)
 *
 * - Lo que ve el estudio vive en paf_portal/{clienteId} (ej. PAF-002).
 * - Solo lo leen los correos de emailsAutorizados, con su propia cuenta de Google
 *   (ver firestore.rules). El ID no sirve como llave: pegar la URL o el ID no alcanza.
 * - Lo arma el CRM a partir de lo que Juan decide publicar (project.pafPortal).
 *   Nunca lleva notas internas, ficha privada, respuestas de Tally ni la carpeta interna.
 * Lógica pura: la usan la app y los tests.
 */

export const PAF_PORTAL_COLLECTION = 'paf_portal';

/** Los 5 hitos de Presencia que muestra el portal (Adquisición y Conversión todavía no van) */
export const PRESENCIA_HITOS = [
  'Nos organizamos',
  'Definimos el foco',
  'Acordamos el mensaje',
  'Lo llevamos a tus canales',
  'Revisamos y cerramos',
] as const;

/** PAF-002, PAF-PRUEBA-001… Un ID no se reutiliza nunca. */
export const CLIENTE_ID_RE = /^PAF-(PRUEBA-)?\d{3,}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PafPortalLinkKey = 'carpeta' | 'materiales' | 'resultados' | 'web' | 'asana';
export const PAF_PORTAL_LINK_LABEL: Record<PafPortalLinkKey, string> = {
  carpeta: 'Tu carpeta',
  materiales: 'Materiales',
  resultados: 'Resultados',
  web: 'Tu web',
  asana: 'Contenido en Asana',
};
export const PAF_PORTAL_LINK_KEYS = Object.keys(PAF_PORTAL_LINK_LABEL) as PafPortalLinkKey[];

/** Lo que Juan carga en la ficha (privado, queda en el proyecto) */
export interface PafPortalDraft {
  emails: string[];
  hito: number; // 1 a 5
  resumen: string;
  enlaces: Partial<Record<PafPortalLinkKey, string>>;
  publishedAt?: string;
}

/** Tareas y entregas publicadas (se completan en el paso 4) */
export interface PafPortalTask {
  id: string;
  titulo: string;
  detalle?: string;
  fecha?: string; // YYYY-MM-DD
  estado: 'habilitada' | 'enviada' | 'aprobada';
}
export interface PafPortalDelivery {
  id: string;
  titulo: string;
  fecha?: string;
  enlace?: string;
}

/** Documento paf_portal/{clienteId}: lo único que lee el cliente */
export interface PafPortalDoc {
  clienteId: string;
  estudio: string;
  emailsAutorizados: string[];
  hitoVisible: number;
  resumenVisible: string;
  enlaces: Partial<Record<PafPortalLinkKey, string>>;
  tareas: PafPortalTask[];
  entregas: PafPortalDelivery[];
  proximaReunion: { fecha: string; hora?: string } | null;
  actualizadoEn: string;
}

export function emptyPortalDraft(email?: string): PafPortalDraft {
  return { emails: email ? normalizeEmails(email) : [], hito: 1, resumen: '', enlaces: {} };
}

/** "Ana@x.com, b@y.com" → ['ana@x.com', 'b@y.com'] (sin repetidos) */
export function normalizeEmails(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[\s,;]+/);
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Solo https, sin usuario ni contraseña en la URL */
export function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Arma el documento público. Copia campo por campo lo publicable: nada del proyecto
 * pasa "de arrastre". Devuelve los errores para mostrarlos en la ficha.
 */
export function buildPafPortal(
  input: { clienteId?: string; estudio: string; draft: PafPortalDraft; tareas?: PafPortalTask[]; entregas?: PafPortalDelivery[]; proximaReunion?: PafPortalDoc['proximaReunion'] },
  now = new Date().toISOString()
): { doc: PafPortalDoc } | { errors: string[] } {
  const errors: string[] = [];
  const clienteId = (input.clienteId || '').trim().toUpperCase();
  if (!CLIENTE_ID_RE.test(clienteId)) errors.push('Falta el ID del cliente (ej. PAF-002 o PAF-PRUEBA-001).');

  const emails = normalizeEmails(input.draft.emails);
  if (!emails.length) errors.push('Agregá al menos un correo autorizado.');
  const wrong = emails.filter((e) => !EMAIL_RE.test(e));
  if (wrong.length) errors.push(`Correo inválido: ${wrong.join(', ')}`);

  const enlaces: PafPortalDoc['enlaces'] = {};
  for (const key of PAF_PORTAL_LINK_KEYS) {
    const raw = input.draft.enlaces[key]?.trim();
    if (!raw) continue;
    const url = safeHttpsUrl(raw);
    if (url) enlaces[key] = url;
    else errors.push(`El enlace "${PAF_PORTAL_LINK_LABEL[key]}" tiene que empezar con https://`);
  }

  if (errors.length) return { errors };
  const hito = Math.min(PRESENCIA_HITOS.length, Math.max(1, Math.round(input.draft.hito || 1)));
  return {
    doc: {
      clienteId,
      estudio: input.estudio.trim(),
      emailsAutorizados: emails,
      hitoVisible: hito,
      resumenVisible: input.draft.resumen.trim().slice(0, 2000),
      enlaces,
      tareas: (input.tareas || []).map(({ id, titulo, detalle, fecha, estado }) => ({ id, titulo, estado, ...(detalle ? { detalle } : {}), ...(fecha ? { fecha } : {}) })),
      entregas: (input.entregas || []).map(({ id, titulo, fecha, enlace }) => ({ id, titulo, ...(fecha ? { fecha } : {}), ...(enlace && safeHttpsUrl(enlace) ? { enlace: safeHttpsUrl(enlace)! } : {}) })),
      proximaReunion: input.proximaReunion || null,
      actualizadoEn: now,
    },
  };
}
