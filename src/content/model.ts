import { addDays, startOfWeekMonday } from '../utils/dates';

/**
 * CONTENIDO
 * Calendario de publicaciones: reels, carruseles y estáticos, con sus slides, guiones,
 * captions y los recursos que se mandan por palabra clave.
 * Lógica pura: la usan la pantalla, el importador y los tests.
 */

export type ContentSupport = 'reel' | 'carrusel' | 'estatico' | 'otro';

export interface ContentSlide {
  /** Original en alta (PNG para publicar) */
  full: string;
  /** 1080 px para verla en la app */
  display: string;
  /** Miniatura para la tira */
  thumb: string;
  px?: string;
}

export interface ContentResource {
  word: string;
  name: string;
  url: string;
}

export interface ContentScript {
  title: string;
  status?: string;
  format?: string;
  what?: string;
  html?: string;
  text?: string;
  caption?: string;
}

export interface ContentPiece {
  id: string;
  number?: number;
  date: string; // YYYY-MM-DD
  weekday?: string;
  pillar?: string;
  pain?: string;
  format?: string;
  support: ContentSupport;
  idea: string;
  cta?: string;
  status: string;
  /** Si cambiaste el estado desde la app, una reimportación no lo pisa */
  statusChangedAt?: string;
  title: string;
  caption?: string;
  script?: ContentScript | null;
  slides: ContentSlide[];
  resources: ContentResource[];
  calendar?: string;
  importedAt?: string;
  updatedAt?: string;
}

// ---------- Estados ----------

export type StatusStage = 'idea' | 'guion' | 'produccion' | 'revisar' | 'listo' | 'publicado';

/** Estados que ofrece el selector, en el orden del trabajo */
export const STATUS_OPTIONS = [
  'idea',
  'guion listo',
  'guion aprobado',
  'grabado',
  'editado',
  'carrusel renderizado (para revisar)',
  'listo para publicar',
  'programado',
  'publicado',
];

export function statusStage(status?: string): StatusStage {
  const s = (status || '').toLowerCase();
  if (s.includes('publicado')) return 'publicado';
  if (s.includes('listo para publicar') || s.includes('programado')) return 'listo';
  if (s.includes('revisar')) return 'revisar';
  if (s.includes('grabado') || s.includes('editado') || s.includes('renderizado') || s.includes('slides')) return 'produccion';
  if (s.includes('guion') || s.includes('texto')) return 'guion';
  return 'idea';
}

export const STAGE_LABEL: Record<StatusStage, string> = {
  idea: 'Idea',
  guion: 'Guion',
  produccion: 'En producción',
  revisar: 'Para revisar',
  listo: 'Lista',
  publicado: 'Publicada',
};

/** Clases de color para el chip de estado */
export const STAGE_TONE: Record<StatusStage, string> = {
  idea: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25',
  guion: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  produccion: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  revisar: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  listo: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  publicado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
};

export const SUPPORT_LABEL: Record<ContentSupport, string> = {
  reel: 'Reel',
  carrusel: 'Carrusel',
  estatico: 'Estático',
  otro: 'Otro',
};

export function supportOf(raw?: string): ContentSupport {
  const s = (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (s.includes('reel') || s.includes('video')) return 'reel';
  if (s.includes('carrusel') || s.includes('carousel')) return 'carrusel';
  if (s.includes('estatic') || s.includes('post') || s.includes('imagen')) return 'estatico';
  return 'otro';
}

// ---------- Semanas ----------

export interface ContentWeek {
  start: string; // lunes
  end: string; // domingo
  pieces: ContentPiece[];
}

export function groupByWeek(pieces: ContentPiece[]): ContentWeek[] {
  const map = new Map<string, ContentPiece[]>();
  [...pieces]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.number || 0) - (b.number || 0))
    .forEach((p) => {
      const k = startOfWeekMonday(p.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
  return [...map.entries()].map(([start, list]) => ({ start, end: addDays(start, 6), pieces: list }));
}

/** La próxima que hay que publicar (hoy o después, no publicada) */
export function nextToPublish(pieces: ContentPiece[], today: string): ContentPiece | null {
  return (
    [...pieces]
      .filter((p) => p.date >= today && statusStage(p.status) !== 'publicado')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.number || 0) - (b.number || 0))[0] || null
  );
}

/** Ya pasó el día y no figura publicada */
export const isLate = (p: ContentPiece, today: string) => p.date < today && statusStage(p.status) !== 'publicado';

export function pieceTitle(p: ContentPiece): string {
  return p.title || p.script?.title || p.idea || 'Sin título';
}

export function shortDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const wd = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

// ---------- Importar (formato del calendario: { titulo, piezas: [...] }) ----------

/** Un archivo del .zip que hay que subir y a dónde va */
export interface ImportAsset {
  zipPath: string;
  storagePath: string;
  kind: 'full' | 'display' | 'thumb' | 'pdf';
  /** Para "display": se genera achicando el original */
  from?: string;
}

export interface ImportPlan {
  title: string;
  pieces: ContentPiece[];
  assets: ImportAsset[];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o && o[k] != null && str(o[k]) !== '' && str(o[k]) !== '—') return str(o[k]);
  return '';
};

/** "19/10" + año del título → ISO, por si una pieza no trae "iso" */
function isoFrom(raw: any, year: number): string {
  const iso = pick(raw, 'iso', 'date', 'fecha_iso');
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const m = pick(raw, 'fecha').match(/^(\d{1,2})\/(\d{1,2})/);
  if (m) return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

/** Rutas dentro del zip: tolera una carpeta raíz ("calendario/c/...") */
export function resolveZipPath(path: string, zipPaths: Set<string>): string | null {
  if (!path) return null;
  const clean = path.replace(/^\.?\//, '');
  if (zipPaths.has(clean)) return clean;
  for (const p of zipPaths) if (p.endsWith(`/${clean}`)) return p;
  return null;
}

/**
 * Convierte el JSON del calendario en piezas + la lista de archivos a subir.
 * `zipPaths`: lo que trae el .zip (si un archivo falta, la pieza se importa igual sin él).
 * `url(storagePath)`: cómo queda la dirección pública del archivo (se completa después de subirlo).
 */
export function planImport(data: any, zipPaths: Set<string>, url: (storagePath: string) => string = (p) => p): ImportPlan {
  const title = str(data?.titulo || data?.title) || 'Calendario';
  const yearMatch = title.match(/20\d\d/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
  const list: any[] = Array.isArray(data?.piezas) ? data.piezas : Array.isArray(data?.pieces) ? data.pieces : Array.isArray(data) ? data : [];
  const assets: ImportAsset[] = [];
  const seenAssets = new Set<string>();
  const add = (a: ImportAsset) => {
    if (seenAssets.has(a.storagePath)) return;
    seenAssets.add(a.storagePath);
    assets.push(a);
  };
  const usedIds = new Set<string>();

  const pieces: ContentPiece[] = [];
  list.forEach((raw, i) => {
    const date = isoFrom(raw, year);
    if (!date) return;
    const num = Number(pick(raw, 'n°', 'n', 'numero', 'number')) || i + 1;
    const g = raw?.guion && typeof raw.guion === 'object' ? raw.guion : null;
    const titleTxt = pick(raw, 'titulo', 'title') || (g ? str(g.titulo) : '');
    let id = slugify(pick(raw, 'slug')) || `${date}-${slugify(titleTxt || pick(raw, 'idea en una línea', 'idea')) || `n${num}`}`;
    while (usedIds.has(id)) id = `${id}-${num}`;
    usedIds.add(id);

    const slides: ContentSlide[] = [];
    (Array.isArray(raw?.slides) ? raw.slides : []).forEach((s: any, j: number) => {
      const nn = String(j + 1).padStart(2, '0');
      const full = resolveZipPath(str(s?.alta || s?.full), zipPaths);
      const mini = resolveZipPath(str(s?.mini || s?.thumb), zipPaths);
      if (!full && !mini) return;
      const base = `contenido/${id}/${nn}`;
      const fullExt = full ? (full.toLowerCase().endsWith('.jpg') || full.toLowerCase().endsWith('.jpeg') ? 'jpg' : 'png') : 'jpg';
      if (full) add({ zipPath: full, storagePath: `${base}.${fullExt}`, kind: 'full' });
      if (full) add({ zipPath: full, storagePath: `${base}-1080.jpg`, kind: 'display', from: full });
      if (mini) add({ zipPath: mini, storagePath: `${base}-mini.jpg`, kind: 'thumb' });
      const fullUrl = full ? url(`${base}.${fullExt}`) : url(`${base}-mini.jpg`);
      slides.push({
        full: fullUrl,
        display: full ? url(`${base}-1080.jpg`) : fullUrl,
        thumb: mini ? url(`${base}-mini.jpg`) : full ? url(`${base}-1080.jpg`) : fullUrl,
        px: str(s?.px) || undefined,
      });
    });

    const resources: ContentResource[] = [];
    (Array.isArray(raw?.recursos) ? raw.recursos : []).forEach((r: any) => {
      const word = str(r?.palabra || r?.word);
      const file = resolveZipPath(str(r?.pub || r?.archivo), zipPaths);
      // Sin archivo (p. ej. un link a la web): la palabra clave queda igual, sin PDF
      if (!file) {
        if (word) resources.push({ word, name: str(r?.nombre || r?.name) || word, url: '' });
        return;
      }
      const name = file.split('/').pop() || 'recurso.pdf';
      const storagePath = `contenido/recursos/${slugify(name.replace(/\.pdf$/i, ''))}.pdf`;
      add({ zipPath: file, storagePath, kind: 'pdf' });
      resources.push({ word, name: str(r?.nombre || r?.name) || name, url: url(storagePath) });
    });

    pieces.push({
      id,
      number: num,
      date,
      weekday: pick(raw, 'día', 'dia') || undefined,
      pillar: pick(raw, 'pilar') || undefined,
      pain: pick(raw, 'dolor') || undefined,
      format: pick(raw, 'formato') || undefined,
      support: supportOf(pick(raw, 'soporte', 'support')),
      idea: pick(raw, 'idea en una línea', 'idea'),
      cta: pick(raw, 'CTA', 'cta') || undefined,
      status: pick(raw, 'estado', 'status') || 'idea',
      title: titleTxt,
      caption: pick(raw, 'caption') || (g ? str(g.caption) : '') || undefined,
      script: g
        ? {
            title: str(g.titulo) || titleTxt,
            status: str(g.estado) || undefined,
            format: str(g.formato) || undefined,
            what: str(g.que) || undefined,
            html: str(g.html) || undefined,
            text: str(g.texto) || undefined,
            caption: str(g.caption) || undefined,
          }
        : null,
      slides,
      resources,
      calendar: title,
    });
  });

  return { title, pieces, assets };
}

/**
 * Al reimportar no se pierde nada: el estado que cambiaste en la app se respeta,
 * y si esta vez no vinieron imágenes o PDF (solo el .json), quedan los que ya estaban.
 */
export function mergeImported(incoming: ContentPiece, existing?: ContentPiece | null): ContentPiece {
  if (!existing) return incoming;
  const out = { ...incoming };
  if (existing.statusChangedAt) {
    out.status = existing.status;
    out.statusChangedAt = existing.statusChangedAt;
  }
  if (out.slides.length === 0 && existing.slides?.length) out.slides = existing.slides;
  if (out.resources.length === 0 && existing.resources?.length) out.resources = existing.resources;
  return out;
}

// ---------- HTML del guion: solo etiquetas de texto, sin atributos ----------

const ALLOWED = new Set(['H3', 'H4', 'H5', 'P', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'BR', 'SPAN', 'SMALL', 'BLOCKQUOTE']);

export function sanitizeScriptHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walk = (node: Element): string =>
    [...node.childNodes]
      .map((c) => {
        if (c.nodeType === 3) return escapeHtml(c.textContent || '');
        if (c.nodeType !== 1) return '';
        const el = c as Element;
        const inner = walk(el);
        if (!ALLOWED.has(el.tagName)) return inner;
        const tag = el.tagName.toLowerCase();
        return tag === 'br' ? '<br>' : `<${tag}>${inner}</${tag}>`;
      })
      .join('');
  return walk(doc.body.firstElementChild as Element);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
