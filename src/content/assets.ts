import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * ARCHIVOS DEL CONTENIDO (slides y PDF) en Firestore, colección content_assets.
 * Firebase Storage no está activo en el proyecto (pide el plan pago), así que cada archivo
 * va como data URL en su propio documento (máx. ~1 MB: las slides a 1080 px pesan ~150–400 KB).
 * En la pieza se guarda la referencia "fs:<id>"; una dirección https también se acepta.
 */

export const ASSET_PREFIX = 'fs:';
const MAX_DOC_CHARS = 1_000_000;

/** "contenido/abc/01-1080.jpg" → "contenido__abc__01-1080.jpg" */
export const assetDocId = (path: string) => path.replace(/\//g, '__');

export const isAssetRef = (ref?: string) => !!ref && ref.startsWith(ASSET_PREFIX);

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function putAsset(path: string, blob: Blob): Promise<string> {
  const data = await blobToDataUrl(blob);
  if (data.length > MAX_DOC_CHARS) throw new Error(`${path}: pesa demasiado (${Math.round(blob.size / 1024)} KB)`);
  const id = assetDocId(path);
  await setDoc(doc(db, 'content_assets', id), { path, type: blob.type, size: blob.size, data, createdAt: new Date().toISOString() });
  cache.set(`${ASSET_PREFIX}${id}`, Promise.resolve(data));
  return `${ASSET_PREFIX}${id}`;
}

const cache = new Map<string, Promise<string>>();

/** Devuelve algo que se puede poner en <img src> o abrir ("" si no existe) */
export function loadAsset(ref: string): Promise<string> {
  if (!isAssetRef(ref)) return Promise.resolve(ref || '');
  let p = cache.get(ref);
  if (!p) {
    p = getDoc(doc(db, 'content_assets', ref.slice(ASSET_PREFIX.length)))
      .then((snap) => (snap.exists() ? String(snap.data().data || '') : ''))
      .catch(() => {
        cache.delete(ref);
        return '';
      });
    cache.set(ref, p);
  }
  return p;
}

export function useAssetUrl(ref?: string): string {
  const [url, setUrl] = useState(() => (ref && !isAssetRef(ref) ? ref : ''));
  useEffect(() => {
    let alive = true;
    if (!ref) return setUrl('');
    if (!isAssetRef(ref)) return setUrl(ref);
    setUrl('');
    loadAsset(ref).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [ref]);
  return url;
}

/** Precarga (para pasar de slide sin espera) */
export const preloadAsset = (ref?: string) => {
  if (ref) loadAsset(ref).then((u) => u && (new Image().src = u));
};

async function toBlob(ref: string): Promise<Blob> {
  const u = await loadAsset(ref);
  if (!u) throw new Error('No se encontró el archivo');
  return (await fetch(u)).blob();
}

export async function downloadAsset(ref: string, name: string) {
  try {
    const blob = await toBlob(ref);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch {
    if (!isAssetRef(ref)) window.open(ref, '_blank', 'noopener');
  }
}
