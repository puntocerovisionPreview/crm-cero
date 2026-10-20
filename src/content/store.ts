import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from '../utils/firestoreService';
import { getAuthHeaders } from '../utils/authAccess';
import { ContentPiece, ImportAsset, mergeImported, planImport } from './model';

// Firestore del contenido: content_pieces (una pieza por documento)

export function subscribeContent(onChanged: (items: ContentPiece[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'content_pieces'),
    (snap) => onChanged(snap.docs.map((d) => ({ slides: [], resources: [], ...(d.data() as ContentPiece), id: d.id }))),
    (err) => {
      console.warn('subscribeContent error:', err);
      onError?.(err);
    }
  );
}

export async function updateContentPiece(id: string, updates: Partial<ContentPiece>): Promise<void> {
  await setDoc(doc(db, 'content_pieces', id), deepSanitize({ ...updates, updatedAt: new Date().toISOString() }), { merge: true });
}

export async function setContentStatus(id: string, status: string): Promise<void> {
  const now = new Date().toISOString();
  await updateContentPiece(id, { status, statusChangedAt: now });
}

// ---------- Importar calendario (JSON + .zip con c/, m/ y r/) ----------

export interface ImportProgress {
  done: number;
  total: number;
  label: string;
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };
const mimeOf = (path: string) => MIME[path.split('.').pop()!.toLowerCase()] || 'application/octet-stream';

/** Achica una imagen a `width` px de ancho y la devuelve en JPEG */
async function toJpeg(bytes: Uint8Array, type: string, width: number): Promise<Blob> {
  const bmp = await createImageBitmap(new Blob([bytes], { type }));
  const scale = Math.min(1, width / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo achicar la imagen'))), 'image/jpeg', 0.86));
}

async function upload(storagePath: string, body: Blob): Promise<string> {
  const headers = { ...(await getAuthHeaders()), 'Content-Type': body.type };
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`/api/content/upload?path=${encodeURIComponent(storagePath)}`, { method: 'POST', headers, body });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) return data.url as string;
      lastErr = data.error || `Error ${r.status}`;
      if (r.status < 500) break; // ruta, permiso o tipo: no tiene sentido reintentar
    } catch (err) {
      lastErr = (err as Error).message;
    }
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
  }
  throw new Error(`${storagePath}: ${lastErr}`);
}

/** Pool simple: N subidas a la vez */
async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

export interface ImportResult {
  pieces: number;
  files: number;
  failed: string[];
}

export async function importCalendar(jsonText: string, zip: File | null, onProgress: (p: ImportProgress) => void): Promise<ImportResult> {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('El archivo .json no se pudo leer. ¿Es el calendario exportado?');
  }

  onProgress({ done: 0, total: 1, label: zip ? 'Abriendo el .zip…' : 'Leyendo el calendario…' });
  let files: Record<string, Uint8Array> = {};
  if (zip) {
    const { unzipSync } = await import('fflate');
    // Solo imágenes y PDF; se ignoran carpetas del sistema (__MACOSX, .DS_Store)
    files = unzipSync(new Uint8Array(await zip.arrayBuffer()), {
      filter: (f) => !f.name.includes('__MACOSX') && /\.(png|jpe?g|webp|pdf)$/i.test(f.name),
    });
  }
  const zipPaths = new Set(Object.keys(files));
  const first = planImport(data, zipPaths);
  if (first.pieces.length === 0) throw new Error('No encontré piezas con fecha en el calendario.');

  const urls = new Map<string, string>();
  const failed: string[] = [];
  let done = 0;
  const total = first.assets.length;
  const step = (a: ImportAsset) =>
    onProgress({ done, total, label: a.kind === 'pdf' ? `Recurso ${a.zipPath.split('/').pop()}` : `Slide ${a.storagePath.replace('contenido/', '')}` });

  await runPool(first.assets, 4, async (a) => {
    step(a);
    try {
      const bytes = files[a.zipPath];
      const blob =
        a.kind === 'display'
          ? await toJpeg(bytes, mimeOf(a.zipPath), 1080)
          : new Blob([bytes], { type: mimeOf(a.storagePath) });
      urls.set(a.storagePath, await upload(a.storagePath, blob));
    } catch (err) {
      failed.push((err as Error).message);
    }
    done++;
    step(a);
  });

  if (total > 0 && urls.size === 0) throw new Error(`No se pudo subir ningún archivo. ${failed[0] || ''}`);

  // Con las direcciones finales; lo que no se pudo subir queda vacío y la pieza se ve sin esa imagen
  const plan = planImport(data, zipPaths, (p) => urls.get(p) || '');
  const pieces = plan.pieces.map((p) => ({
    ...p,
    slides: p.slides.filter((s) => s.full || s.display || s.thumb),
  }));

  onProgress({ done: total, total: total || 1, label: 'Guardando las piezas…' });
  const existing = new Map<string, ContentPiece>();
  (await getDocs(collection(db, 'content_pieces'))).docs.forEach((d) => existing.set(d.id, d.data() as ContentPiece));
  const now = new Date().toISOString();
  for (let i = 0; i < pieces.length; i += 400) {
    const batch = writeBatch(db);
    pieces.slice(i, i + 400).forEach((p) => {
      const merged = mergeImported(p, existing.get(p.id));
      batch.set(doc(db, 'content_pieces', p.id), deepSanitize({ ...merged, importedAt: now, updatedAt: now }));
    });
    await batch.commit();
  }
  return { pieces: pieces.length, files: urls.size, failed };
}
