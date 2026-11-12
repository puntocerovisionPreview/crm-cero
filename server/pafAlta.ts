import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { DrivePending, driveRequest } from './driveOAuth';
import { ensureFolder, shareFolder } from './driveFiles';
import { verifiedEmail } from './pafPortal';
import { CLIENTE_ID_RE, PAF_PORTAL_COLLECTION, PORTAL_SEPARATE_FIELDS, draftAccesos, emptyPortalDraft, portalFromProject } from '../src/portal/model';
import { limpiarRespuestas, partesDe, type ItemCopiado, type PafArranque } from '../src/portal/arranque';
import { aplicarAlta, type AltaLinks } from '../src/portal/altaLinks';
import { habilitarMateriales } from '../src/portal/tareasArranque';
import type { DriveFolder } from '../src/automation/webRecipe';

/**
 * ALTA SIN TALLY (servidor)
 * 1. El estudio manda sus datos desde el portal (POST /api/paf/arranque).
 * 2. Se guardan en la ficha (privado: el portal nunca los muestra).
 * 3. Se copian las carpetas modelo del Drive de .CERO (la del cliente y la interna).
 * 4. Se comparte SOLO la del cliente, con el correo que puso, sin mail automático de Google.
 * 5. Los links van a la ficha y al portal, y se habilita la carta "Tus materiales".
 * Solo corre si el cliente tiene prendido el alta nueva. Cada paso se puede repetir sin duplicar.
 */

// Carpetas modelo (00_MODELO_CLIENTE y 00_MODELO_INTERNO en el Drive de puntocerovision@gmail.com)
const MODELO_CLIENTE = process.env.PAF_MODELO_CLIENTE || '1yDAdi1GeZLc-sd31-pXlTgu-YSK6Xeeq';
const MODELO_INTERNO = process.env.PAF_MODELO_INTERNO || '1MIPK8TW81YieDiLOWVoE5SIrJEE9JX1s';
const FOLDER = 'application/vnd.google-apps.folder';
const carpetaUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
const archivoUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const nuevoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function listar(db: Firestore, folderId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const out: { id: string; name: string; mimeType: string }[] = [];
  let page = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const r = await driveRequest(db, `files?q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
    out.push(...(r.files || []));
    page = r.nextPageToken || '';
  } while (page);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Copia el contenido de una carpeta modelo adentro de otra. No duplica si se repite. */
async function copiarArbol(db: Firestore, origen: string, destino: string, clave: string, ruta: string[] = [], items: ItemCopiado[] = []): Promise<ItemCopiado[]> {
  for (const it of await listar(db, origen)) {
    const r = [...ruta, it.name];
    if (it.mimeType === FOLDER) {
      const id = await ensureFolder(db, `${clave}/${r.join('/')}`, it.name, destino);
      items.push({ ruta: r, url: carpetaUrl(id), carpeta: true });
      await copiarArbol(db, it.id, id, clave, r, items);
    } else {
      const q = encodeURIComponent(`'${destino}' in parents and trashed=false and appProperties has { key='ceroModelo' and value='${it.id}' }`);
      const found = await driveRequest(db, `files?q=${q}&fields=files(id)&pageSize=1`);
      const id = found.files?.[0]?.id || (await driveRequest(db, `files/${it.id}/copy?fields=id`, 'POST', { name: it.name, parents: [destino], appProperties: { ceroModelo: it.id } })).id;
      items.push({ ruta: r, url: archivoUrl(id), carpeta: false });
    }
  }
  return items;
}

/** Explica en criollo por qué no se pudieron crear las carpetas */
function motivoDrive(e: any): string {
  if (e instanceof DrivePending) return e.message;
  if ([403, 404].includes(Number(e?.status))) return 'Drive no deja leer las carpetas modelo: reconectá Google Drive en Ajustes → Automatizaciones (aceptando ver tus archivos).';
  return String(e?.message || e).slice(0, 300);
}

async function crearCarpetas(db: Firestore, clienteId: string, estudio: string, compartirCon?: string): Promise<{ links: AltaLinks; compartidaCon?: string }> {
  const nombre = `${clienteId} · ${estudio}`.slice(0, 120);
  const raiz = await ensureFolder(db, 'paf-raiz', 'Clientes PAF · .CERO');
  const comp = await ensureFolder(db, `paf:${clienteId}:compartida`, nombre, raiz);
  const itemsC = await copiarArbol(db, MODELO_CLIENTE, comp, `paf:${clienteId}:compartida`);
  const raizInterna = await ensureFolder(db, 'paf-raiz-interna', 'Clientes PAF · .CERO (interno)');
  const int = await ensureFolder(db, `paf:${clienteId}:interna`, `${nombre} (interno)`, raizInterna);
  const itemsI = await copiarArbol(db, MODELO_INTERNO, int, `paf:${clienteId}:interna`);
  let compartidaCon: string | undefined;
  if (compartirCon) {
    // Solo la carpeta del cliente; la interna nunca se comparte
    const folder: DriveFolder = { id: comp, key: 'paf', name: nombre, url: carpetaUrl(comp), role: 'writer', status: 'creada' };
    await shareFolder(db, folder, compartirCon, 'writer');
    compartidaCon = compartirCon.trim().toLowerCase();
  }
  return { links: partesDe({ url: carpetaUrl(comp), items: itemsC }, { url: carpetaUrl(int), items: itemsI }), compartidaCon };
}

/** Lleva las carpetas a la ficha y al portal, y habilita "Tus materiales" */
async function aplicarYPublicar(db: Firestore, ref: FirebaseFirestore.DocumentReference, project: any, links: AltaLinks, arranque: PafArranque) {
  const draft = project.pafPortal || emptyPortalDraft();
  const r = aplicarAlta(project, { ...draft, accesos: draftAccesos(draft) }, links, nuevoId);
  const ahora = new Date().toISOString();
  const tareas = habilitarMateriales(r?.pafTareas || project.pafTareas, ahora, nuevoId) || r?.pafTareas;
  const updates: Record<string, unknown> = {
    pafArranque: arranque,
    ...(r ? { pafDrive: r.pafDrive, pafPortal: { ...r.draft, ...(draft.publishedAt ? { publishedAt: draft.publishedAt } : {}) } } : {}),
    ...(tareas ? { pafTareas: tareas } : {}),
    updatedAt: ahora,
  };
  const next = { ...project, ...updates };
  // Si el portal ya está publicado, se actualiza ahora mismo (el cliente ve sus carpetas en segundos)
  if (next.pafPortal?.publishedAt && next.pafClienteId) {
    const meetings = (await db.collection('meetings').where('projectId', '==', project.id).get()).docs.map((d) => ({ ...(d.data() as any), id: d.id }));
    const result = portalFromProject(next, meetings, next.pafPortal, next.pafClienteId, new Date(), [links.carpetaInterna, links.ficha]);
    if ('doc' in result) {
      const own = Object.fromEntries(Object.entries(result.doc).filter(([k]) => !(PORTAL_SEPARATE_FIELDS as readonly string[]).includes(k)));
      await db.collection(PAF_PORTAL_COLLECTION).doc(result.doc.clienteId).set(own, { mergeFields: Object.keys(own) });
      updates.pafPortal = { ...(updates.pafPortal as object || next.pafPortal), publishedAt: result.doc.actualizadoEn };
    }
  }
  await ref.set(updates, { merge: true });
}

/** Corre el alta (o la reintenta) con las respuestas guardadas */
async function correrAlta(db: Firestore, ref: FirebaseFirestore.DocumentReference, notify: (t: string, b: string, url: string) => Promise<void>) {
  const project = { ...((await ref.get()).data() as any), id: ref.id };
  const a: PafArranque = project.pafArranque;
  const compartir = String(a.respuestas.emailCarpeta || a.email || '');
  try {
    const { links, compartidaCon } = await crearCarpetas(db, project.pafClienteId, String(a.respuestas.estudio || project.clientName), compartir);
    const listo: PafArranque = { ...a, estado: 'listo', carpetas: links, ...(compartidaCon ? { compartidaCon } : {}), error: '', actualizadoEn: new Date().toISOString() };
    await aplicarYPublicar(db, ref, project, links, listo);
    await notify(`${project.clientName} completó sus datos`, 'Sus carpetas ya están creadas y compartidas. Le aparece "Tus materiales" en su portal.', `/clientes/${project.id}`).catch(() => undefined);
    return { ok: true as const };
  } catch (e) {
    const error = motivoDrive(e);
    await ref.set({ pafArranque: { ...a, estado: 'error', error, actualizadoEn: new Date().toISOString() } }, { merge: true });
    // Republica para que el portal no quede diciendo "creando" para siempre: vuelve a mostrar el estado
    await notify(`No se pudieron crear las carpetas de ${project.clientName}`, `${error} Entrá a su ficha y tocá Reintentar.`, `/clientes/${project.id}`).catch(() => undefined);
    return { ok: false as const, error };
  }
}

export function registerPafAltaRoutes(
  app: express.Express,
  requireOwner: express.RequestHandler,
  getDb: () => Firestore | null,
  notify: (title: string, body: string, url: string) => Promise<void>
) {
  // El estudio manda sus datos desde el portal
  app.post('/api/paf/arranque', async (req, res) => {
    const clienteId = String(req.body?.clienteId || '').toUpperCase();
    if (!CLIENTE_ID_RE.test(clienteId)) return res.status(400).json({ error: 'Pedido inválido' });
    const email = await verifiedEmail(req);
    if (!email) return res.status(401).json({ error: 'Iniciá sesión con tu cuenta de Google.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'No disponible en este momento.' });
    const { respuestas, errores } = limpiarRespuestas(req.body?.respuestas);
    if (errores.length) return res.status(400).json({ error: errores.join(' ') });
    try {
      const portal = (await db.collection(PAF_PORTAL_COLLECTION).doc(clienteId).get()).data() as any;
      if (!portal || !(portal.emailsAutorizados || []).includes(email)) return res.status(403).json({ error: 'Esta cuenta no tiene acceso a este portal.' });
      const snap = await db.collection('projects').where('pafClienteId', '==', clienteId).limit(1).get();
      const doc = snap.docs[0];
      if (!doc) return res.status(404).json({ error: 'No encontramos tu ficha. Avisale a .CERO.' });
      const project = doc.data() as any;
      if (!project.pafAltaNueva) return res.status(409).json({ error: 'Este portal todavía usa el formulario anterior.' });
      if (project.pafArranque?.estado === 'listo') return res.json({ ok: true, yaEstaba: true });
      const ahora = new Date().toISOString();
      const arranque: PafArranque = { respuestas, email, enviadoEn: project.pafArranque?.enviadoEn || ahora, estado: 'creando', actualizadoEn: ahora };
      await doc.ref.set({ pafArranque: arranque }, { merge: true });
      // El portal pasa a "estamos creando tus carpetas" mientras tanto
      await db.collection(PAF_PORTAL_COLLECTION).doc(clienteId).set({ arranque: { pendiente: false, creando: true } }, { merge: true });
      const r = await correrAlta(db, doc.ref, notify);
      if (!r.ok) await db.collection(PAF_PORTAL_COLLECTION).doc(clienteId).set({ arranque: { pendiente: false, creando: true } }, { merge: true });
      return res.json({ ok: true, carpetas: r.ok });
    } catch (e) {
      console.error('[paf-alta]', e);
      return res.status(500).json({ error: 'No pudimos guardar tus datos. Probá de nuevo en un rato.' });
    }
  });

  // Juan reintenta desde la ficha (ej. después de reconectar Drive)
  app.post('/api/paf/arranque/reintentar', requireOwner, async (req, res) => {
    const projectId = String(req.body?.projectId || '');
    const db = getDb();
    if (!db || !projectId) return res.status(400).json({ error: 'Pedido inválido' });
    const ref = db.collection('projects').doc(projectId);
    const project = (await ref.get()).data() as any;
    if (!project?.pafArranque?.respuestas) return res.status(409).json({ error: 'Todavía no completó sus datos.' });
    const r = await correrAlta(db, ref, notify);
    return r.ok ? res.json({ ok: true }) : res.status(502).json({ error: r.error });
  });
}
