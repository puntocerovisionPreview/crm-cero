import type express from 'express';
import { timingSafeEqual } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { SIGNATURE_BOX } from '../src/utils/signatureBox';

/**
 * DOCUMENSO: el cliente firma el presupuesto digitalmente.
 *
 * - DOCUMENSO_URL (Secrets): tu instancia, ej. https://firma.tudominio.com (sin /api al final).
 *   Si usás la versión en la nube, https://app.documenso.com.
 * - DOCUMENSO_API_KEY: Documenso → Ajustes → API Tokens (empieza con "api_").
 * - DOCUMENSO_WEBHOOK_SECRET (opcional pero recomendado): el mismo secreto que cargás en
 *   Documenso → Webhooks, apuntando a https://TU-APP/api/documenso/webhook con el evento
 *   DOCUMENT_COMPLETED. Así el presupuesto queda "aceptado" solo cuando firman.
 *
 * La app arma el PDF (react-pdf) y lo manda acá; el servidor crea el sobre con el campo de
 * firma en el recuadro del PDF (utils/signatureBox.ts) y Documenso le manda el mail al cliente.
 */

const base = () => (process.env.DOCUMENSO_URL || 'https://app.documenso.com').replace(/\/+$/, '');

export function isDocumensoConfigured(): boolean {
  return Boolean(process.env.DOCUMENSO_API_KEY);
}

async function documenso(path: string, init: RequestInit): Promise<any> {
  const r = await fetch(`${base()}/api/v2${path}`, {
    ...init,
    headers: { Authorization: String(process.env.DOCUMENSO_API_KEY), ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Documenso respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const money = (n: number, cur: string) => `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

function secretOk(req: express.Request): boolean {
  const expected = process.env.DOCUMENSO_WEBHOOK_SECRET || '';
  const given = String(req.headers['x-documenso-secret'] || '');
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function registerDocumensoRoutes(
  app: express.Express,
  requireOwner: express.RequestHandler,
  getDb: () => Firestore | null,
  notify: (title: string, body: string) => Promise<void>
) {
  // Botón "Enviar a firmar" en la app
  app.post('/api/documenso/enviar', requireOwner, async (req, res) => {
    if (!isDocumensoConfigured()) return res.status(400).json({ error: 'Falta DOCUMENSO_API_KEY en los Secrets' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'El servidor no tiene acceso a la base de datos' });

    const docId = String(req.body?.docId || '');
    const pdfBase64 = String(req.body?.pdfBase64 || '');
    const pages = Math.max(1, Math.min(50, Number(req.body?.pages) || 1));
    if (!docId || !pdfBase64) return res.status(400).json({ error: 'Falta el documento o el PDF' });

    try {
      const ref = db.collection('documents').doc(docId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'No encontramos el presupuesto' });
      const d = snap.data() || {};
      if (d.kind !== 'presupuesto') return res.status(400).json({ error: 'Solo los presupuestos se mandan a firmar' });
      if (!d.email) return res.status(400).json({ error: 'El presupuesto no tiene el mail del cliente: cargalo para mandarlo a firmar' });
      if (d.signature?.status === 'pendiente') return res.status(409).json({ error: 'Ya está enviado a firmar' });

      const title = `Presupuesto N° ${String(d.number).padStart(4, '0')} · ${d.clientName}`;
      const form = new FormData();
      form.append(
        'payload',
        JSON.stringify({
          type: 'DOCUMENT',
          title,
          externalId: docId,
          recipients: [
            {
              email: d.email,
              name: d.contactName || d.clientName,
              role: 'SIGNER',
              // El recuadro de firma está abajo de cada hoja: se firma en la última
              fields: [{ identifier: 0, type: 'SIGNATURE', page: pages, ...SIGNATURE_BOX }],
            },
          ],
        })
      );
      form.append('files', new Blob([Buffer.from(pdfBase64, 'base64')], { type: 'application/pdf' }), `${title}.pdf`);

      const created = await documenso('/envelope/create', { method: 'POST', body: form });
      const envelopeId = String(created.id || '');
      if (!envelopeId) throw new Error('Documenso no devolvió el id del sobre');

      const sent = await documenso('/envelope/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envelopeId }),
      });
      const signingUrl = (sent.recipients || []).find((r: any) => String(r.email).toLowerCase() === String(d.email).toLowerCase())?.signingUrl;

      const signature = { provider: 'documenso', envelopeId, status: 'pendiente', sentAt: new Date().toISOString(), ...(signingUrl ? { signingUrl } : {}) };
      await ref.set({ signature }, { merge: true });
      await db
        .collection('student_portals')
        .doc(`doc_${d.token}`)
        .set({ signatureStatus: 'pendiente', signingUrl: signingUrl || null }, { merge: true });

      res.json({ ok: true, envelopeId, signingUrl: signingUrl || null });
    } catch (err) {
      console.error('[documenso] enviar:', (err as Error).message);
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // Documenso avisa cuando el cliente firmó (o rechazó)
  app.post('/api/documenso/webhook', async (req, res) => {
    if (!secretOk(req)) return res.status(401).end();
    res.status(200).end();
    try {
      const event = String(req.body?.event || '');
      const payload = req.body?.payload || {};
      const envelopeId = String(payload.envelopeId || '');
      if (!envelopeId || !['DOCUMENT_COMPLETED', 'DOCUMENT_REJECTED'].includes(event)) return;
      const db = getDb();
      if (!db) return;

      const found = await db.collection('documents').where('signature.envelopeId', '==', envelopeId).limit(1).get();
      const doc = found.docs[0];
      if (!doc) return;
      const d = doc.data();
      const now = new Date().toISOString();

      if (event === 'DOCUMENT_REJECTED') {
        await doc.ref.set({ signature: { status: 'rechazado' } }, { merge: true });
        await db.collection('student_portals').doc(`doc_${d.token}`).set({ signatureStatus: 'rechazado', signingUrl: null }, { merge: true });
        await notify(`✋ ${d.clientName} rechazó la firma`, `El presupuesto N° ${String(d.number).padStart(4, '0')} no se firmó.`).catch(() => undefined);
        return;
      }

      const signer = (payload.recipients || [])[0];
      const acceptedName = String(signer?.name || d.contactName || d.clientName);
      const update = { status: 'aceptado', acceptedAt: payload.completedAt || now, acceptedName };
      await doc.ref.set({ ...update, signature: { status: 'firmado', signedAt: payload.completedAt || now } }, { merge: true });
      await db
        .collection('student_portals')
        .doc(`doc_${d.token}`)
        .set({ ...update, signatureStatus: 'firmado', signingUrl: null }, { merge: true });

      const total = (d.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
      await notify(`✍️ ${d.clientName} firmó el presupuesto`, `${acceptedName} firmó ${money(total, d.currency)}.`).catch(() => undefined);
    } catch (err) {
      console.error('[documenso] webhook:', (err as Error).message);
    }
  });

  app.get('/api/documenso/status', requireOwner, (_req, res) => {
    res.json({ configured: isDocumensoConfigured(), webhookSigned: Boolean(process.env.DOCUMENSO_WEBHOOK_SECRET), url: base() });
  });
}
