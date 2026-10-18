import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * PRESUPUESTOS: el cliente toca "Acepto" en el link y el servidor lo registra.
 * La copia pública vive en student_portals/doc_{token} (lectura por link, sin listar);
 * el original en documents/{id}. Solo se puede aceptar un presupuesto enviado.
 */

const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/;
const money = (n: number, cur: string) => `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

export function registerDocumentRoutes(
  app: express.Express,
  getDb: () => Firestore | null,
  notify: (title: string, body: string) => Promise<void>
) {
  app.post('/api/documento/:token/aceptar', async (req, res) => {
    const token = String(req.params.token || '');
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!TOKEN_RE.test(token)) return res.status(404).json({ error: 'Link inválido' });
    if (name.length < 2) return res.status(400).json({ error: 'Escribí tu nombre para aceptar' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'No se pudo registrar ahora. Avisá por WhatsApp que lo aceptás.' });

    try {
      const pubRef = db.collection('student_portals').doc(`doc_${token}`);
      const snap = await pubRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'No encontramos este presupuesto' });
      const data = snap.data() || {};
      if (data.kind !== 'presupuesto') return res.status(400).json({ error: 'Este documento no se acepta' });
      if (data.status === 'aceptado') return res.json({ ok: true, already: true });

      const update = { status: 'aceptado', acceptedAt: new Date().toISOString(), acceptedName: name };
      await pubRef.set(update, { merge: true });
      const originals = await db.collection('documents').where('token', '==', token).limit(1).get();
      await Promise.all(originals.docs.map((d) => d.ref.set(update, { merge: true })));

      await notify(`✅ ${data.clientName} aceptó el presupuesto`, `${name} aceptó ${money(Number(data.total) || 0, data.currency)}.`).catch(() => undefined);
      res.json({ ok: true });
    } catch (err) {
      console.error('[documentos] aceptar:', (err as Error).message);
      res.status(500).json({ error: 'No se pudo registrar. Probá de nuevo o avisá por WhatsApp.' });
    }
  });
}
