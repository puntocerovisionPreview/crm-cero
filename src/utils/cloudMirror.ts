import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from './sanitize';

/**
 * COPIA EN LA NUBE DE DATOS QUE ANTES VIVÍAN SOLO EN EL NAVEGADOR
 * (horas trabajadas y papelera). El navegador sigue siendo la copia rápida; cada cambio
 * se refleja en Firestore y, al abrir la app, se combinan las dos.
 *
 * Para no "resucitar" lo que borraste en otro dispositivo, se recuerda qué ids ya
 * estaban en la nube: si uno de esos falta allá, se borró en otro lado y se quita acá.
 */

type WithId = { id: string };

const syncedKey = (name: string) => `cero_cloud_synced_${name}`;

function readSynced(name: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(syncedKey(name)) || '[]'));
  } catch {
    return new Set();
  }
}

function writeSynced(name: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(syncedKey(name), JSON.stringify([...ids]));
  } catch {
    /* sin espacio: la próxima combinación lo corrige */
  }
}

async function commitOps(ops: Array<(b: ReturnType<typeof writeBatch>) => void>) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

/** Refleja en la nube la diferencia entre la lista anterior y la nueva. */
export function mirrorChanges<T extends WithId>(name: string, prev: T[], next: T[]): void {
  const before = new Map(prev.map((x) => [x.id, JSON.stringify(x)]));
  const nextIds = new Set(next.map((x) => x.id));
  const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
  next.forEach((item) => {
    if (before.get(item.id) !== JSON.stringify(item)) ops.push((b) => b.set(doc(db, name, item.id), deepSanitize(item)));
  });
  prev.forEach((item) => {
    if (!nextIds.has(item.id)) ops.push((b) => b.delete(doc(db, name, item.id)));
  });
  if (!ops.length) return;
  commitOps(ops)
    .then(() => {
      const synced = readSynced(name);
      next.forEach((x) => synced.add(x.id));
      prev.forEach((x) => !nextIds.has(x.id) && synced.delete(x.id));
      writeSynced(name, synced);
    })
    .catch((err) => console.warn(`[nube] No se pudo guardar ${name}:`, err?.message || err));
}

/**
 * Combina lo local con la nube. Devuelve la lista final (para guardarla localmente).
 * - En la nube y no acá → se agrega.
 * - Acá, nunca subido → se sube.
 * - Acá, ya subido antes, pero ya no está en la nube → se borró en otro dispositivo.
 */
export async function mergeWithCloud<T extends WithId>(name: string, local: T[]): Promise<T[]> {
  const snap = await getDocs(collection(db, name));
  const cloud = new Map(snap.docs.map((d) => [d.id, { ...(d.data() as T), id: d.id }]));
  const synced = readSynced(name);
  const result: T[] = [];
  const toUpload: T[] = [];
  local.forEach((item) => {
    if (cloud.has(item.id)) {
      result.push(cloud.get(item.id)!);
      cloud.delete(item.id);
    } else if (!synced.has(item.id)) {
      result.push(item);
      toUpload.push(item);
    }
  });
  cloud.forEach((item) => result.push(item));
  if (toUpload.length) await commitOps(toUpload.map((item) => (b) => b.set(doc(db, name, item.id), deepSanitize(item))));
  writeSynced(name, result.map((x) => x.id));
  return result;
}
