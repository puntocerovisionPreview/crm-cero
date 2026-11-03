import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { CLIENTE_ID_RE, PAF_PORTAL_COLLECTION, checkTerminado } from '../src/portal/model';

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
}
