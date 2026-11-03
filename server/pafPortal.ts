import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { CLIENTE_ID_RE, PAF_PORTAL_COLLECTION, checkPieza, checkTerminado, portalPieces } from '../src/portal/model';
import { ClientPanel, applyClientAction, panelDocId, parseClientAction, snapshotOf } from '../src/panels/model';

/**
 * PORTAL PAF: cuando el estudio toca "Terminé", el portal guarda el aviso en Firestore
 * y además llama acá para que te llegue el aviso (push / Telegram) aunque el CRM esté cerrado.
 * Solo avisa: no cambia nada. Verifica la cuenta, el portal, la tarea y que el aviso exista.
 */

const hits = new Map<string, number[]>();
function tooMany(key: string): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 2000) hits.clear();
  return list.length > 10;
}

/** Correo verificado de un token de Firebase (cualquier cuenta, no solo las del CRM) */
async function verifiedEmail(req: express.Request): Promise<string | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (!r.ok) return null;
    const user = ((await r.json()) as any)?.users?.[0];
    return user?.emailVerified && user.email ? String(user.email).toLowerCase() : null;
  } catch {
    return null;
  }
}

export function registerPafPortalRoutes(
  app: express.Express,
  getDb: () => Firestore | null,
  notify: (title: string, body: string, url: string) => Promise<void>
) {
  app.post('/api/paf/terminado', async (req, res) => {
    const clienteId = String(req.body?.clienteId || '');
    const tareaId = String(req.body?.tareaId || '');
    if (!CLIENTE_ID_RE.test(clienteId) || !tareaId || tareaId.length > 60) return res.status(400).json({ error: 'Pedido inválido' });
    const email = await verifiedEmail(req);
    if (!email) return res.status(401).json({ error: 'Iniciá sesión' });
    if (tooMany(email)) return res.status(429).json({ error: 'Demasiados avisos seguidos' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Aviso no disponible' });
    try {
      const portal = (await db.collection(PAF_PORTAL_COLLECTION).doc(clienteId).get()).data() as any;
      const check = checkTerminado(portal, email, tareaId);
      if ('error' in check) return res.status(403).json({ error: check.error });
      // Solo avisa si el aviso quedó guardado (el portal lo escribe antes de llamar acá)
      const aviso = await db.collection(PAF_PORTAL_COLLECTION).doc(clienteId).collection('avisos')
        .where('tareaId', '==', tareaId).where('email', '==', email).limit(1).get();
      if (aviso.empty) return res.status(409).json({ error: 'Aviso no encontrado' });
      const project = await db.collection('projects').where('pafClienteId', '==', clienteId).limit(1).get();
      const url = project.empty ? '/clientes' : `/clientes/${project.docs[0].id}`;
      res.json({ ok: true });
      await notify(`✅ ${portal.estudio} terminó una tarea`, `"${check.titulo}". Revisala y aprobala desde su ficha.`, url).catch(() => undefined);
    } catch (err) {
      console.error('[portal PAF] terminado:', (err as Error).message);
      res.status(500).json({ error: 'No se pudo avisar' });
    }
  });

  /**
   * Contenido para aprobar: el estudio aprueba o pide cambios desde su portal.
   * Se aplica sobre el panel del estudio (misma lógica que el portal anterior) y se
   * actualiza la copia del portal nuevo. Te avisa por push/Telegram.
   */
  app.post('/api/paf/pieza', async (req, res) => {
    const clienteId = String(req.body?.clienteId || '');
    const action = parseClientAction({ type: 'pieza', pieceId: req.body?.pieceId, decision: req.body?.decision, comment: req.body?.comment });
    if (!CLIENTE_ID_RE.test(clienteId) || !action || action.type !== 'pieza') {
      return res.status(400).json({ error: req.body?.decision === 'cambios' ? 'Contanos qué cambiar' : 'Pedido inválido' });
    }
    const email = await verifiedEmail(req);
    if (!email) return res.status(401).json({ error: 'Iniciá sesión' });
    if (tooMany(email)) return res.status(429).json({ error: 'Demasiados cambios seguidos. Esperá un minuto.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'No se pudo guardar ahora. Avisale a Juan por WhatsApp.' });
    try {
      const portalRef = db.collection(PAF_PORTAL_COLLECTION).doc(clienteId);
      const portal = (await portalRef.get()).data() as any;
      const check = checkPieza(portal, email, action.pieceId);
      if ('error' in check) return res.status(403).json({ error: check.error });
      const project = await db.collection('projects').where('pafClienteId', '==', clienteId).limit(1).get();
      if (project.empty) return res.status(404).json({ error: 'No encontramos tu estudio' });
      const found = await db.collection('client_panels').where('projectId', '==', project.docs[0].id).limit(1).get();
      const ref = found.docs[0]?.ref;
      const panel = found.docs[0]?.data() as ClientPanel | undefined;
      if (!ref || !panel) return res.status(404).json({ error: 'No encontramos el contenido' });
      const result = applyClientAction({ ...panel, id: ref.id }, action);
      if ('error' in result) return res.status(404).json({ error: result.error });
      const batch = db.batch();
      batch.set(ref, JSON.parse(JSON.stringify(result.panel)));
      if (panel.active) batch.set(db.collection('student_portals').doc(panelDocId(panel.token)), JSON.parse(JSON.stringify(snapshotOf(result.panel))));
      batch.set(portalRef, { piezas: JSON.parse(JSON.stringify(portalPieces(result.panel.pieces))) }, { merge: true });
      await batch.commit();
      res.json({ ok: true });
      await notify(result.notice.title, result.notice.body, `/clientes/${project.docs[0].id}`).catch(() => undefined);
    } catch (err) {
      console.error('[portal PAF] pieza:', (err as Error).message);
      res.status(500).json({ error: 'No se pudo guardar. Probá de nuevo.' });
    }
  });
}