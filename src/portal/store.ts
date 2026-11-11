import { addDoc, arrayUnion, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { crearConReintentos } from './altaSegura';
import { db } from '../firebase';
import { getAuthHeaders } from '../utils/authAccess';
import { PAF_PEDIDOS_COLLECTION, PAF_PORTAL_COLLECTION, PORTAL_SEPARATE_FIELDS, clienteIdNumber, portalFromProject, suggestClienteId, suggestWebClienteId, type PafAviso, type PafPedidoAlta, type PafPortalDoc } from './model';
import { PAF_VISITAS_COLLECTION, type PortalVisita } from './salud';

// Portal PAF: paf_portal/{clienteId}. Escribe solo Juan (CRM); el cliente solo lee el suyo
// y deja avisos de "terminé" en paf_portal/{clienteId}/avisos.

/** Publica todo lo que sale de la ficha. No toca objetivos ni contacto (se publican aparte). */
export async function publishPafPortal(portal: PafPortalDoc): Promise<void> {
  const own = Object.fromEntries(Object.entries(portal).filter(([k]) => !(PORTAL_SEPARATE_FIELDS as readonly string[]).includes(k)));
  await setDoc(doc(db, PAF_PORTAL_COLLECTION, portal.clienteId), own, { mergeFields: Object.keys(own) });
}

/** Objetivos de la semana y/o WhatsApp de Juan en un portal ya publicado */
export async function publishPortalExtras(clienteId: string, extras: Pick<PafPortalDoc, 'objetivos' | 'contacto' | 'piezas'>): Promise<void> {
  await setDoc(doc(db, PAF_PORTAL_COLLECTION, clienteId), extras, { merge: true });
}

// Configuración general del portal (por ahora, el WhatsApp de Juan para el botón)
const configRef = () => doc(db, 'settings', 'paf_portal');

export function subscribePafConfig(onChanged: (c: { whatsapp?: string }) => void) {
  return onSnapshot(configRef(), (snap) => onChanged((snap.data() as { whatsapp?: string }) || {}), () => onChanged({}));
}

export async function savePafConfig(config: { whatsapp?: string }): Promise<void> {
  await setDoc(configRef(), config, { merge: true });
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
  // Antes fallaba en silencio: ahora el error llega a la ficha
  if ('errors' in r) throw new Error(`Se guardó en la ficha, pero el portal no se actualizó: ${r.errors.join(' ')}`);
  try {
    await publishPafPortal(r.doc);
  } catch {
    throw new Error('Se guardó en la ficha, pero no se pudo actualizar el portal. Revisá la conexión y reintentá.');
  }
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
  // Aviso a Juan por push/Telegram aunque el CRM esté cerrado. Si falla, el aviso igual quedó guardado.
  getAuthHeaders()
    .then((headers) => fetch('/api/paf/terminado', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, tareaId }) }))
    .catch(() => undefined);
}

/** El estudio entró a su portal: el servidor guarda la fecha (una vez por hora como mucho) */
export function sendVisita(clienteId: string): void {
  getAuthHeaders()
    .then((headers) => fetch('/api/paf/visita', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }), keepalive: true }))
    .catch(() => undefined);
}

/** Para el CRM: cuándo entró cada estudio a su portal, por clienteId */
export function subscribeVisitas(onChanged: (visitas: Map<string, PortalVisita>) => void) {
  return onSnapshot(
    collection(db, PAF_VISITAS_COLLECTION),
    (snap) => onChanged(new Map(snap.docs.map((d) => [d.id, { ...(d.data() as Omit<PortalVisita, 'id'>), id: d.id }]))),
    () => onChanged(new Map())
  );
}

/** Para el CRM: los avisos de todos los portales, agrupados por clienteId */
export function subscribeAllAvisos(onChanged: (byCliente: Map<string, PafAviso[]>) => void) {
  return onSnapshot(
    collectionGroup(db, 'avisos'),
    (snap) => {
      const byCliente = new Map<string, PafAviso[]>();
      snap.docs.forEach((d) => {
        const clienteId = d.ref.parent.parent?.id;
        if (!clienteId || d.ref.parent.parent?.parent.id !== PAF_PORTAL_COLLECTION) return;
        const aviso = toAviso(d.id, d.data());
        if (!aviso.creadoEn) return;
        byCliente.set(clienteId, [...(byCliente.get(clienteId) || []), aviso]);
      });
      onChanged(byCliente);
    },
    (err) => console.warn('Avisos PAF:', err.message)
  );
}

/** Juan o el cliente: los avisos del portal (los sin hora todavía se están guardando) */
export function subscribeAvisos(clienteId: string, onChanged: (items: PafAviso[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    avisosOf(clienteId),
    (snap) => onChanged(snap.docs.map((d) => toAviso(d.id, d.data())).filter((a) => a.creadoEn)),
    (err) => onError?.(err)
  );
}

// ---------- Avisos que ya viste (en cualquier dispositivo) ----------

const leidosRef = () => doc(db, 'settings', 'avisos_leidos');

export function subscribeAvisosLeidos(onChanged: (keys: Set<string>) => void) {
  return onSnapshot(leidosRef(), (snap) => onChanged(new Set((snap.data()?.keys as string[]) || [])), () => onChanged(new Set()));
}

export async function markAvisosLeidos(keys: string[]): Promise<void> {
  if (keys.length) await setDoc(leidosRef(), { keys: arrayUnion(...keys) }, { merge: true });
}

// ---------- Pedidos de alta (los procesa el Apps Script) ----------

// El contador evita repetir un ID aunque se borre un pedido o una ficha
const counterRef = () => doc(db, 'settings', 'paf_ids');

/** Próximo ID libre (real o de prueba), mirando pedidos, fichas y el contador */
export async function suggestNextClienteId(prueba: boolean): Promise<string> {
  const [pedidos, fichas, counter, portales] = await Promise.all([
    getDocs(collection(db, PAF_PEDIDOS_COLLECTION)),
    getDocs(query(collection(db, 'projects'), where('pafClienteId', '>=', 'PAF-'))),
    getDoc(counterRef()),
    getDocs(collection(db, PAF_PORTAL_COLLECTION)),
  ]);
  const used = [
    ...pedidos.docs.map((d) => String(d.data().clienteId || d.id)),
    ...fichas.docs.map((d) => String(d.data().pafClienteId || '')),
    ...portales.docs.map((d) => d.id),
  ];
  const last = Number(counter.data()?.[prueba ? 'ultimoPrueba' : 'ultimoReal'] || 0);
  return suggestClienteId(used, prueba, last);
}

/** Próximo WEB-### libre (clientes Web: no pasan por el alta de Tally) */
export async function suggestNextWebClienteId(): Promise<string> {
  const [fichas, portales] = await Promise.all([
    getDocs(query(collection(db, 'projects'), where('pafClienteId', '>=', 'WEB-'))),
    getDocs(collection(db, PAF_PORTAL_COLLECTION)),
  ]);
  return suggestWebClienteId([...fichas.docs.map((d) => String(d.data().pafClienteId || '')), ...portales.docs.map((d) => d.id)]);
}

/**
 * Guarda el pedido en paf_pedidos_alta/{clienteId}: el ID es la clave, así no se puede
 * usar dos veces. Solo se reescribe si el pedido anterior con ese ID quedó en error.
 */
export async function createPedidoAlta(pedido: Omit<PafPedidoAlta, 'id'>, replacesId?: string): Promise<string> {
  const id = pedido.clienteId!;
  const ref = doc(db, PAF_PEDIDOS_COLLECTION, id);
  await runTransaction(db, async (tx) => {
    const [prev, counter] = await Promise.all([tx.get(ref), tx.get(counterRef())]);
    if (prev.exists() && prev.data().estado !== 'error') throw new Error(`El ID ${id} ya se usó. Elegí otro.`);
    const key = pedido.prueba ? 'ultimoPrueba' : 'ultimoReal';
    const n = clienteIdNumber(id, pedido.prueba) || 0;
    tx.set(ref, pedido);
    // Pedido viejo sin ID del mismo estudio: se reemplaza por este
    if (replacesId && replacesId !== id) tx.delete(doc(db, PAF_PEDIDOS_COLLECTION, replacesId));
    if (n > Number(counter.data()?.[key] || 0)) tx.set(counterRef(), { [key]: n }, { merge: true });
  });
  return id;
}
/** Alta con reintentos: busca el ID si falta, salta los ya usados y reintenta si se corta la conexión */
export const crearPedidoAltaSeguro = (
  armar: Parameters<typeof crearConReintentos>[1],
  opts: Parameters<typeof crearConReintentos>[2]
) => crearConReintentos({ sugerir: suggestNextClienteId, crear: createPedidoAlta }, armar, opts);

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

/** El estudio aprueba o pide cambios en una pieza (lo aplica el servidor) */
export async function sendPiezaDecision(clienteId: string, pieceId: string, decision: 'aprobar' | 'cambios', comment?: string): Promise<void> {
  const res = await fetch('/api/paf/pieza', {
    method: 'POST',
    headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ clienteId, pieceId, decision, comment }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'No se pudo guardar. Probá de nuevo.');
}
