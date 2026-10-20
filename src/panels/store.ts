import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from '../utils/firestoreService';
import { deletePublicAssets, putPublicAsset } from '../content/assets';
import { toJpeg } from '../content/store';
import { sortByFileName } from '../content/model';
import { ClientPanel, PanelSlide, PanelSnapshot, TOKEN_RE, newToken, panelDocId, snapshotOf } from './model';
import { startOfWeekMonday, todayLocal } from '../utils/dates';

// Paneles de clientes: client_panels/{id} (tuyo) y student_portals/panel_{token} (lo que ve el cliente)

export function subscribePanels(onChanged: (items: ClientPanel[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'client_panels'),
    (snap) => onChanged(snap.docs.map((d) => ({ goals: [], tasks: [], pieces: [], ...(d.data() as ClientPanel), id: d.id }))),
    (err) => {
      console.warn('subscribePanels error:', err);
      onError?.(err);
    }
  );
}

/** Guarda el panel y publica lo que ve el cliente (si está activo) */
export async function savePanel(p: ClientPanel): Promise<void> {
  const now = new Date().toISOString();
  const next = { ...p, updatedAt: now };
  await setDoc(doc(db, 'client_panels', p.id), deepSanitize(next));
  const pub = doc(db, 'student_portals', panelDocId(p.token));
  if (p.active) await setDoc(pub, deepSanitize(snapshotOf(next, now)));
  else await deleteDoc(pub).catch(() => undefined);
}

export async function createPanel(clientName: string, extra: Partial<ClientPanel> = {}): Promise<ClientPanel> {
  const today = todayLocal();
  const p: ClientPanel = {
    id: `panel_${Date.now().toString(36)}`,
    token: newToken(),
    active: true,
    clientName: clientName.trim(),
    weekStart: startOfWeekMonday(today),
    goals: [],
    tasks: [],
    pieces: [],
    createdAt: new Date().toISOString(),
    ...extra,
  };
  await savePanel(p);
  return p;
}

/** Link nuevo: el anterior deja de funcionar */
export async function renewPanelLink(p: ClientPanel): Promise<ClientPanel> {
  await deleteDoc(doc(db, 'student_portals', panelDocId(p.token))).catch(() => undefined);
  const next = { ...p, token: newToken() };
  await savePanel(next);
  return next;
}

export const slideRefs = (slides: PanelSlide[]) => slides.flatMap((s) => [s.display, s.thumb]);

export async function deletePanel(p: ClientPanel): Promise<void> {
  await deleteDoc(doc(db, 'student_portals', panelDocId(p.token))).catch(() => undefined);
  await deletePublicAssets(p.pieces.flatMap((x) => slideRefs(x.slides)));
  await deleteDoc(doc(db, 'client_panels', p.id));
}

export const panelUrl = (token: string) => `${window.location.origin}/panel/${token}`;

/**
 * Imágenes del cliente: en el orden del nombre de archivo (01, 02…), a 1080 px y con miniatura.
 * Van a la parte pública para que el cliente las vea desde el link.
 */
export async function uploadPanelSlides(files: File[], onProgress?: (done: number, total: number) => void): Promise<PanelSlide[]> {
  const slides: PanelSlide[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    const f = files[i];
    const bytes = new Uint8Array(await f.arrayBuffer());
    const type = f.type || 'image/png';
    const display = await putPublicAsset(await toJpeg(bytes, type, 1080));
    const thumb = await putPublicAsset(await toJpeg(bytes, type, 360, 120_000));
    slides.push({ display, thumb });
  }
  onProgress?.(files.length, files.length);
  return slides;
}

export { sortByFileName };

// ---------- Lado del cliente (página pública) ----------

export function subscribePanelSnapshot(token: string, onChanged: (s: PanelSnapshot | null) => void, onError: () => void) {
  if (!TOKEN_RE.test(token)) {
    onChanged(null);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, 'student_portals', panelDocId(token)),
    (snap) => onChanged(snap.exists() ? (snap.data() as PanelSnapshot) : null),
    () => onError()
  );
}

export async function sendClientAction(token: string, body: Record<string, unknown>): Promise<void> {
  const r = await fetch(`/api/panel/${encodeURIComponent(token)}/accion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo guardar. Probá de nuevo.');
  }
}
