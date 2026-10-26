/**
 * PANEL DEL CLIENTE · DESARROLLO WEB
 * Etapas del proyecto, materiales que necesitás del cliente, la versión de prueba
 * (link de previsualización) para aprobar o pedir cambios por página, pagos y entrega.
 * Después de entregada, el cliente te pide cambios desde acá (las webs las editás vos).
 * Lógica pura: la usan la app, el servidor y los tests.
 */

export type WebStage = 'brief' | 'contenido' | 'diseno' | 'desarrollo' | 'revision' | 'publicada';

export const WEB_STAGES: { id: WebStage; label: string; client: string }[] = [
  { id: 'brief', label: 'Brief', client: 'Definimos qué necesita tu web y para quién es.' },
  { id: 'contenido', label: 'Contenido', client: 'Juntamos textos, fotos y logo.' },
  { id: 'diseno', label: 'Diseño', client: 'Armamos cómo se va a ver.' },
  { id: 'desarrollo', label: 'Desarrollo', client: 'La construimos.' },
  { id: 'revision', label: 'Revisión', client: 'La revisás en la versión de prueba.' },
  { id: 'publicada', label: 'Publicada', client: 'Tu web ya está online.' },
];

export const stageIndex = (s: WebStage) => Math.max(0, WEB_STAGES.findIndex((x) => x.id === s));

export interface WebMaterial {
  driveFolderUrl?: string;
  id: string;
  title: string;
  date?: string;
  done: boolean;
  doneAt?: string;
  /** Link que dejó el cliente (Drive, Dropbox…) */
  link?: string;
}

export type WebPreviewState = 'revisar' | 'aprobada' | 'cambios';

export interface WebPreview {
  url: string;
  round: number;
  maxRounds: number;
  state: WebPreviewState;
  sentAt: string;
  reviewedAt?: string;
}

export interface WebRequest {
  id: string;
  /** revision: cambio pedido sobre la versión de prueba · cambio: pedido después de publicada */
  kind: 'revision' | 'cambio';
  page?: string;
  text: string;
  round?: number;
  at: string;
  done: boolean;
  doneAt?: string;
}

export interface WebPayment {
  id: string;
  label: string;
  amount?: number;
  currency: 'ARS' | 'USD';
  paid: boolean;
  paidAt?: string;
}

export interface WebSection {
  stage: WebStage;
  pages: string[];
  materials: WebMaterial[];
  preview?: WebPreview;
  requests: WebRequest[];
  payments: WebPayment[];
  delivery?: { url?: string; date?: string };
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Panel web nuevo: páginas y materiales típicos (se editan) */
export function emptyWeb(): WebSection {
  return {
    stage: 'brief',
    pages: ['Inicio', 'Servicios', 'Proyectos', 'Contacto'],
    materials: [
      { id: uid(), title: 'Logo en buena calidad', done: false },
      { id: uid(), title: 'Textos de cada página (o los puntos clave)', done: false },
      { id: uid(), title: 'Fotos de obras o proyectos', done: false },
      { id: uid(), title: 'Datos de contacto y redes', done: false },
      { id: uid(), title: 'Datos del dominio (dónde está registrado)', done: false },
    ],
    requests: [],
    payments: [],
  };
}

/** Mandás (o volvés a mandar) la versión de prueba: si había cambios pedidos, empieza otra ronda */
export function sendPreview(w: WebSection, url: string, maxRounds: number, now = new Date().toISOString()): WebSection {
  const prev = w.preview;
  const round = !prev ? 1 : prev.state === 'cambios' ? prev.round + 1 : prev.round;
  return {
    ...w,
    stage: stageIndex(w.stage) < stageIndex('revision') ? 'revision' : w.stage,
    preview: { url: url.trim(), round, maxRounds: Math.max(1, maxRounds), state: 'revisar', sentAt: now },
  };
}

export const money = (n: number, cur: 'ARS' | 'USD') => `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

export function webSummary(w: WebSection) {
  return {
    materialsMissing: w.materials.filter((m) => !m.done).length,
    openRequests: w.requests.filter((r) => !r.done).length,
    toReview: w.preview?.state === 'revisar',
    changes: w.preview?.state === 'cambios',
    unpaid: w.payments.filter((p) => !p.paid).length,
  };
}

/** Pedidos agrupados por página (sin página = "General") */
export function requestsByPage(list: WebRequest[]): { page: string; items: WebRequest[] }[] {
  const map = new Map<string, WebRequest[]>();
  list.forEach((r) => {
    const k = r.page || 'General';
    map.set(k, [...(map.get(k) || []), r]);
  });
  return [...map.entries()].map(([page, items]) => ({ page, items }));
}

// ---------- Acciones del cliente ----------

export type WebClientAction =
  | { type: 'material'; id: string; done: boolean; link?: string }
  | { type: 'prueba'; decision: 'aprobar' | 'cambios'; items: { page?: string; text: string }[] }
  | { type: 'pedido'; page?: string; text: string };

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);
const cleanLink = (s: unknown) => {
  const v = clean(s, 500);
  return /^https?:\/\//i.test(v) ? v : v ? `https://${v}` : '';
};

export function parseWebAction(body: any): WebClientAction | null {
  if (body?.type === 'material' && typeof body.id === 'string') {
    return { type: 'material', id: clean(body.id, 40), done: !!body.done, link: cleanLink(body.link) || undefined };
  }
  if (body?.type === 'prueba' && (body.decision === 'aprobar' || body.decision === 'cambios')) {
    const items = (Array.isArray(body.items) ? body.items : [])
      .slice(0, 30)
      .map((x: any) => ({ page: clean(x?.page, 60) || undefined, text: clean(x?.text, 1000) }))
      .filter((x: any) => x.text);
    if (body.decision === 'cambios' && !items.length) return null;
    return { type: 'prueba', decision: body.decision, items: body.decision === 'cambios' ? items : [] };
  }
  if (body?.type === 'pedido') {
    const text = clean(body.text, 1000);
    if (!text) return null;
    return { type: 'pedido', text, page: clean(body.page, 60) || undefined };
  }
  return null;
}

export function applyWebAction(
  w: WebSection,
  a: WebClientAction,
  clientName: string,
  now: string
): { web: WebSection; text: string; title: string; body: string } | { error: string } {
  if (a.type === 'material') {
    const m = w.materials.find((x) => x.id === a.id);
    if (!m) return { error: 'No encontramos ese material' };
    const materials = w.materials.map((x) => (x.id === a.id ? { ...x, done: a.done, doneAt: a.done ? now : undefined, link: a.link ?? x.link } : x));
    const text = a.done ? `mandó "${m.title}"` : `desmarcó "${m.title}"`;
    return { web: { ...w, materials }, text, title: `📎 ${clientName} ${text}`, body: a.link ? `Link: ${a.link}` : 'Desde su panel.' };
  }
  if (a.type === 'prueba') {
    if (!w.preview || w.preview.state !== 'revisar') return { error: 'No hay una versión para revisar ahora' };
    const round = w.preview.round;
    if (a.decision === 'aprobar') {
      return {
        web: { ...w, preview: { ...w.preview, state: 'aprobada', reviewedAt: now } },
        text: `aprobó la versión de prueba (ronda ${round})`,
        title: `👍 ${clientName} aprobó la web (ronda ${round})`,
        body: 'Ya la podés publicar.',
      };
    }
    const added: WebRequest[] = a.items.map((x) => ({ id: uid(), kind: 'revision', page: x.page, text: x.text, round, at: now, done: false }));
    return {
      web: { ...w, preview: { ...w.preview, state: 'cambios', reviewedAt: now }, requests: [...w.requests, ...added] },
      text: `pidió ${added.length} ${added.length === 1 ? 'cambio' : 'cambios'} en la ronda ${round}`,
      title: `✏️ ${clientName} pidió ${added.length} ${added.length === 1 ? 'cambio' : 'cambios'} (ronda ${round})`,
      body: added.map((x) => `${x.page ? `${x.page}: ` : ''}${x.text}`).join('\n').slice(0, 300),
    };
  }
  const req: WebRequest = { id: uid(), kind: 'cambio', page: a.page, text: a.text, at: now, done: false };
  return {
    web: { ...w, requests: [...w.requests, req] },
    text: `pidió un cambio en su web`,
    title: `🛠️ ${clientName} pidió un cambio en su web`,
    body: `${a.page ? `${a.page}: ` : ''}${a.text}`.slice(0, 300),
  };
}
