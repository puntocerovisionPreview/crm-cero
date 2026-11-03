import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { ClientPanel, TOKEN_RE, applyClientAction, panelDocId, parseClientAction, snapshotOf } from '../src/panels/model';

/**
 * PANEL DEL CLIENTE: lo que hace el cliente desde su link (marcar una tarea, aprobar o pedir
 * cambios en una pieza). Público pero acotado: el token es la llave y solo se pueden tocar
 * esas dos cosas. Se guarda en tu panel y en la copia que ve el cliente, y te avisa.
 */

const hits = new Map<string, number[]>();
function tooMany(token: string): boolean {
  const now = Date.now();
  const list = (hits.get(token) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(token, list);
  if (hits.size > 2000) hits.clear();
  return list.length > 30;
}

export function registerPanelRoutes(app: express.Express, getDb: () => Firestore | null, notify: (title: string, body: string) => Promise<void>) {
  app.post('/api/panel/:token/accion', async (req, res) => {
    const token = String(req.params.token || '');
    if (!TOKEN_RE.test(token)) return res.status(404).json({ error: 'Link inválido' });
    if (tooMany(token)) return res.status(429).json({ error: 'Demasiados cambios seguidos. Esperá un minuto.' });
    const action = parseClientAction(req.body);
    if (!action) return res.status(400).json({ error: action === null && req.body?.decision === 'cambios' ? 'Contanos qué cambiar' : 'Pedido inválido' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'No se pudo guardar ahora. Avisale por WhatsApp.' });
    try {
      const found = await db.collection('client_panels').where('token', '==', token).limit(1).get();
      const ref = found.docs[0]?.ref;
      const panel = found.docs[0]?.data() as ClientPanel | undefined;
      if (!ref || !panel || !panel.active) return res.status(404).json({ error: 'Este panel no está disponible' });
      const result = applyClientAction({ ...panel, id: ref.id }, action);
      if ('error' in result) return res.status(404).json({ error: result.error });
      const clean = JSON.parse(JSON.stringify(result.panel));
      await ref.set(clean);
      await db.collection('student_portals').doc(panelDocId(token)).set(JSON.parse(JSON.stringify(snapshotOf(result.panel))));
      res.json({ ok: true });
      await notify(result.notice.title, result.notice.body).catch(() => undefined);
    } catch (err) {
      console.error('[paneles] acción:', (err as Error).message);
      res.status(500).json({ error: 'No se pudo guardar. Probá de nuevo.' });
    }
  });
}
