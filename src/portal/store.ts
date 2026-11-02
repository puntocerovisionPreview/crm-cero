import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { PAF_PEDIDOS_COLLECTION, PAF_PORTAL_COLLECTION, portalFromProject, type PafAviso, type PafPedidoAlta, type PafPortalDoc } from './model';

// Portal PAF: paf_portal/{clienteId}. Escribe solo Juan (CRM); el cliente solo lee el suyo
// y deja avisos de "terminé" en paf_portal/{clienteId}/avisos.

export async function publishPafPortal(portal: PafPortalDoc): Promise<void> {
  await setDoc(doc(db, PAF_PORTAL_COLLECTION, portal.clienteId), portal);
}

/**
 * Si el portal ya está publicado, lo vuelve a armar con los datos nuevos de la ficha
 * (tareas habilitadas, entregas publicadas, próxima reunión). Si no, no publica nada.
 */
export async function republishIfPublished(
  project: Parameters<typeof portalFromProject>[0],
  meetings: Parameters<typeof portalFromProject>[1]
): Promise<void> {
  if (!project.pafClienteId || !project.pafPortal?.publishedAt) return;
  const r = portalFromProject(project, meetings);
  if ('doc' in r) await publishPafPortal(r.doc);
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

// ---------- Avisos de "terminé" ----------

const avisosOf = (clienteId: string) => collection(db, PAF_PORTAL_COLLECTION, clienteId, 'avisos');

function toAviso(id: string, data: any): PafAviso {
  const at = data.creadoEn?.toDate?.() as Date | undefined;
  return { id, tareaId: String(data.tareaId || ''), email: String(data.email || ''), creadoEn: at ? at.toISOString() : '' };
}

/** El cliente avisa que terminó una tarea (las reglas solo dejan estos tres campos) */
export async function sendTaskDone(clienteId: string, tareaId: string, email: string): Promise<void> {
  await addDoc(avisosOf(clienteId), { tareaId, email: email.toLowerCase(), creadoEn: serverTimestamp() });
}

/** Juan o el cliente: los avisos del portal (los sin hora todavía se están guardando) */
export function subscribeAvisos(clienteId: string, onChanged: (items: PafAviso[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    avisosOf(clienteId),
    (snap) => onChanged(snap.docs.map((d) => toAviso(d.id, d.data())).filter((a) => a.creadoEn)),
    (err) => onError?.(err)
  );
}

// ---------- Pedidos de alta (los procesa el Apps Script) ----------

export async function createPedidoAlta(pedido: Omit<PafPedidoAlta, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, PAF_PEDIDOS_COLLECTION), pedido);
  return ref.id;
}

/** El último pedido de alta del proyecto (o null) */
export function subscribePedidoDeProyecto(projectId: string, onChanged: (p: PafPedidoAlta | null) => void) {
  return onSnapshot(
    query(collection(db, PAF_PEDIDOS_COLLECTION), where('projectId', '==', projectId)),
    (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as Omit<PafPedidoAlta, 'id'>), id: d.id }));
      items.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
      onChanged(items[0] || null);
    },
    () => onChanged(null)
  );
}
