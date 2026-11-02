import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { PAF_PORTAL_COLLECTION, type PafPortalDoc } from './model';

// Portal PAF: paf_portal/{clienteId}. Escribe solo Juan (CRM); el cliente solo lee el suyo.

export async function publishPafPortal(portal: PafPortalDoc): Promise<void> {
  await setDoc(doc(db, PAF_PORTAL_COLLECTION, portal.clienteId), portal);
}

export async function unpublishPafPortal(clienteId: string): Promise<void> {
  await deleteDoc(doc(db, PAF_PORTAL_COLLECTION, clienteId));
}

/** Para la ficha (Juan): si el portal está publicado y cuándo se actualizó */
export function subscribePafPortal(clienteId: string, onChanged: (p: PafPortalDoc | null) => void) {
  return onSnapshot(
    doc(db, PAF_PORTAL_COLLECTION, clienteId),
    (snap) => onChanged(snap.exists() ? (snap.data() as PafPortalDoc) : null),
    () => onChanged(null)
  );
}

/**
 * Para el cliente: los portales donde figura su correo. La consulta tiene que filtrar
 * por su correo; las reglas rechazan cualquier otra (no se puede listar la colección).
 */
export function subscribeMyPafPortals(email: string, onChanged: (items: PafPortalDoc[]) => void, onError: (err: Error) => void) {
  return onSnapshot(
    query(collection(db, PAF_PORTAL_COLLECTION), where('emailsAutorizados', 'array-contains', email.toLowerCase())),
    (snap) => onChanged(snap.docs.map((d) => d.data() as PafPortalDoc).sort((a, b) => a.estudio.localeCompare(b.estudio))),
    onError
  );
}
