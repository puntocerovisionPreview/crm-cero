import type express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { calculateProjectBilling, resolveProjectAgreement } from '../src/utils/paymentPlans';
import { normalizeClientName } from '../src/utils/clients';

/**
 * MERCADO PAGO: los cobros entran solos y te propone a qué cliente corresponden.
 *
 * - MP_ACCESS_TOKEN (Secrets): Access Token de producción de tu aplicación de Mercado Pago.
 * - Webhook opcional: https://TU-APP/api/mercadopago/webhook?key=CRON_SECRET
 *   (si cargás MP_WEBHOOK_SECRET, además se valida la firma de Mercado Pago).
 * - Sin webhook, la tarea "frecuente" del reloj o el botón "Buscar pagos" revisan los últimos 15 días.
 *
 * Cada pago aprobado queda en mp_incoming/{id} con una sugerencia; vos confirmás en la app.
 * La API devuelve tanto lo que te pagaron como lo que pagaste vos: cada pago se marca
 * como "recibido" o "enviado" comparando el cobrador y el pagador con tu cuenta (/users/me).
 * Las transferencias bancarias al CVU no siempre aparecen en esta API: solo pagos y envíos de dinero.
 */

const API = 'https://api.mercadopago.com';

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

async function mp(path: string): Promise<any> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---- Tu cuenta de Mercado Pago (para saber si un pago entró o salió) ----
let myAccount: { id: string; email?: string } | null = null;
async function getMyAccount() {
  if (myAccount) return myAccount;
  try {
    const me = await mp('/users/me');
    myAccount = { id: String(me.id), email: me.email ? String(me.email).toLowerCase() : undefined };
  } catch (err) {
    console.warn('[mercadopago] No se pudo leer /users/me:', (err as Error).message);
  }
  return myAccount;
}

export type MpDirection = 'recibido' | 'enviado';

/** "recibido" si el cobrador sos vos; "enviado" si el pagador sos vos. */
export function paymentDirection(raw: any, me: { id: string; email?: string } | null): MpDirection {
  const collector = raw?.collector_id != null ? String(raw.collector_id) : raw?.collector?.id != null ? String(raw.collector.id) : '';
  const payerId = raw?.payer?.id != null ? String(raw.payer.id) : '';
  const payerEmail = String(raw?.payer?.email || '').toLowerCase();
  if (me) {
    if (collector && collector === me.id) return 'recibido';
    if ((payerId && payerId === me.id) || (me.email && payerEmail === me.email)) return 'enviado';
    if (collector && collector !== me.id) return 'enviado';
  }
  return 'recibido';
}

export interface MpSuggestion {
  projectId: string;
  clientName: string;
  reason: string;
  score: number;
}

/** Elige el cliente más probable para un pago (monto que coincide con lo pendiente y/o nombre). */
export function suggestProjectForPayment(
  payment: { amount: number; currency: string; payerName?: string; payerEmail?: string; description?: string },
  projects: any[],
  incomes: any[]
): MpSuggestion | null {
  const payerTokens = new Set(
    normalizeClientName([payment.payerName, (payment.payerEmail || '').split('@')[0], payment.description].filter(Boolean).join(' '))
      .split(' ')
      .filter((t) => t.length >= 3)
  );
  let best: MpSuggestion | null = null;

  projects
    .filter((p) => !p.archived && !p.isLead)
    .forEach((p) => {
      const billing = calculateProjectBilling(p, incomes);
      if (billing.saldoPendiente <= 0) return;
      let score = 0;
      const reasons: string[] = [];

      if (billing.currency === payment.currency) {
        const expected = new Set<number>([billing.saldoPendiente]);
        resolveProjectAgreement(p, incomes).installments.forEach((c: any) => {
          const pend = (Number(c.expectedAmount) || 0) - (Number(c.actualPaidAmount) || 0);
          if (pend > 0) expected.add(pend);
        });
        billing.commitments.forEach((c: any) => {
          const pend = (Number(c.amount) || 0) - (Number(c.amountPaid) || 0);
          if (c.status !== 'cobrado' && pend > 0) expected.add(pend);
        });
        const match = [...expected].find((e) => Math.abs(e - payment.amount) <= Math.max(1, e * 0.01));
        if (match !== undefined) {
          score += 60;
          reasons.push(match === billing.saldoPendiente ? 'el monto es su saldo pendiente' : 'el monto coincide con una cuota pendiente');
        }
      }

      const nameTokens = normalizeClientName([p.clientName, p.ownerName].filter(Boolean).join(' '))
        .split(' ')
        .filter((t: string) => t.length >= 3);
      if (nameTokens.some((t: string) => payerTokens.has(t))) {
        score += 40;
        reasons.push('el nombre del pagador coincide');
      }

      if (score >= 40 && (!best || score > best.score)) {
        best = { projectId: p.id, clientName: p.clientName, reason: reasons.join(' y '), score };
      }
    });

  return best;
}

function toIncoming(raw: any, direction: MpDirection = 'recibido') {
  const payerName = [raw.payer?.first_name, raw.payer?.last_name].filter(Boolean).join(' ') || raw.payer?.nickname || undefined;
  return {
    id: String(raw.id),
    mpPaymentId: String(raw.id),
    direction,
    status: raw.status,
    amount: Number(raw.transaction_amount) || 0,
    currency: raw.currency_id === 'USD' ? 'USD' : 'ARS',
    payerName,
    payerEmail: raw.payer?.email || undefined,
    payerIdentification: raw.payer?.identification?.number ? `${raw.payer.identification.type || ''} ${raw.payer.identification.number}`.trim() : undefined,
    description: raw.description || undefined,
    dateCreated: String(raw.date_created || '').slice(0, 10),
    // Fecha y hora completas: ordena los pagos del mismo día y muestra la hora
    dateTime: raw.date_approved || raw.date_created || undefined,
    dateApproved: raw.date_approved ? String(raw.date_approved).slice(0, 10) : undefined,
    reconciled: false,
  };
}

async function loadForMatching(db: Firestore) {
  const [p, i] = await Promise.all([db.collection('projects').get(), db.collection('incomes').get()]);
  return { projects: p.docs.map((d) => ({ ...d.data(), id: d.id })), incomes: i.docs.map((d) => ({ ...d.data(), id: d.id })) };
}

/** Pagos aprobados con su sentido (recibido / enviado). */
export async function classifyPayments(rawPayments: any[]) {
  const me = await getMyAccount();
  return rawPayments
    .filter((r) => r?.status === 'approved' && Number(r.transaction_amount) > 0)
    .map((raw) => toIncoming(raw, paymentDirection(raw, me)));
}

/**
 * Guarda los pagos aprobados que todavía no estaban. Devuelve los nuevos (para avisar).
 * Un pago que ya existe NO se pisa (si ya lo registraste o descartaste, queda así);
 * solo se le corrige el sentido si no lo tenía.
 */
export async function ingestPayments(db: Firestore, rawPayments: any[]) {
  const classified = await classifyPayments(rawPayments);
  if (classified.length === 0) return [];
  const { projects, incomes } = await loadForMatching(db);
  const created: Array<ReturnType<typeof toIncoming> & { suggestion?: MpSuggestion | null }> = [];
  for (const incoming of classified) {
    const ref = db.collection('mp_incoming').doc(incoming.id);
    const existing = await ref.get();
    if (existing.exists) {
      const patch: Record<string, unknown> = {};
      if (existing.get('direction') !== incoming.direction) patch.direction = incoming.direction;
      if (!existing.get('dateTime') && incoming.dateTime) patch.dateTime = incoming.dateTime;
      if (Object.keys(patch).length) await ref.set(patch, { merge: true });
      continue;
    }
    // A lo que pagaste vos no se le busca cliente
    const suggestion = incoming.direction === 'recibido' ? suggestProjectForPayment(incoming, projects, incomes) : null;
    await ref.set({ ...incoming, ...(suggestion ? { suggestion } : {}), receivedAt: new Date().toISOString() });
    created.push({ ...incoming, suggestion });
  }
  return created;
}

export async function syncRecentPayments(db: Firestore) {
  const q = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    range: 'date_created',
    begin_date: 'NOW-15DAYS',
    end_date: 'NOW',
    limit: '50',
  });
  const data = await mp(`/v1/payments/search?${q}`);
  return ingestPayments(db, data.results || []);
}

export function describeNewPayment(p: { amount: number; currency: string; payerName?: string; description?: string; direction?: MpDirection; suggestion?: MpSuggestion | null }) {
  const money = `${p.currency === 'USD' ? 'US$' : '$'} ${Math.round(p.amount).toLocaleString('es-AR')}`;
  if (p.direction === 'enviado') {
    return {
      title: `Pagaste ${money}`,
      body: `${p.description ? `${p.description}. ` : ''}Tocá para registrarlo como gasto o ignorarlo.`,
    };
  }
  return {
    title: `Te entró un pago de ${money}`,
    body: `${p.payerName ? `De ${p.payerName}. ` : ''}${p.suggestion ? `¿Es de ${p.suggestion.clientName}? (${p.suggestion.reason})` : 'Tocá para registrarlo.'}`,
  };
}

function webhookSignatureOk(req: express.Request): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  const sig = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const dataId = String((req.query['data.id'] as string) || req.body?.data?.id || '');
  if (!secret || !sig || !dataId) return false;
  const parts = Object.fromEntries(sig.split(',').map((kv) => kv.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

function cronKeyOk(req: express.Request): boolean {
  const expected = process.env.CRON_SECRET || '';
  const given = String(req.query.key || '');
  return expected.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function registerMercadoPagoRoutes(
  app: express.Express,
  requireOwner: express.RequestHandler,
  getDb: () => Firestore | null,
  notify: (title: string, body: string) => Promise<void>
) {
  // Mercado Pago avisa acá cada pago nuevo
  app.post('/api/mercadopago/webhook', async (req, res) => {
    if (!webhookSignatureOk(req) && !cronKeyOk(req)) return res.status(401).end();
    // Mercado Pago espera respuesta rápida; el trabajo sigue después
    res.status(200).end();
    try {
      const db = getDb();
      const type = String(req.query.type || req.query.topic || req.body?.type || req.body?.topic || req.body?.action || '');
      const id = String((req.query['data.id'] as string) || req.query.id || req.body?.data?.id || req.body?.id || '');
      if (!isMercadoPagoConfigured() || !id) return;

      let rawPayment: any = null;
      try {
        rawPayment = await mp(`/v1/payments/${encodeURIComponent(id)}`);
      } catch (mpErr) {
        console.warn('[mercadopago] No se pudo obtener el pago', id, (mpErr as Error).message);
        return;
      }
      if (!rawPayment) return;

      // Mismo camino que la sincronización: no pisa lo ya registrado y avisa solo lo nuevo que ENTRÓ
      // (Mercado Pago manda varios avisos por el mismo pago: creado, actualizado…)
      if (db) {
        try {
          const created = await ingestPayments(db, [rawPayment]);
          for (const p of created) {
            if (p.direction !== 'recibido') continue;
            const n = describeNewPayment(p);
            await notify(n.title, n.body);
          }
          return;
        } catch (dbErr) {
          console.warn('[mercadopago] No se pudo guardar en Firestore (se avisa igual):', (dbErr as Error).message);
        }
      }
      const [incoming] = await classifyPayments([rawPayment]);
      if (incoming && incoming.direction === 'recibido') {
        const n = describeNewPayment(incoming);
        await notify(n.title, n.body);
      }
    } catch (err) {
      console.error('[mercadopago] webhook error:', (err as Error).message);
    }
  });

  // Botón "Buscar pagos" en la app
  app.post('/api/mercadopago/sync', requireOwner, async (_req, res) => {
    if (!isMercadoPagoConfigured()) return res.status(400).json({ error: 'Falta MP_ACCESS_TOKEN en los Secrets' });
    try {
      const q = new URLSearchParams({
        sort: 'date_created',
        criteria: 'desc',
        range: 'date_created',
        begin_date: 'NOW-15DAYS',
        end_date: 'NOW',
        limit: '50',
      });
      const data = await mp(`/v1/payments/search?${q}`);
      const rawPayments = data.results || [];
      const db = getDb();
      let created: any[] = [];
      if (db) {
        try {
          created = await ingestPayments(db, rawPayments);
        } catch (dbErr) {
          console.warn('[mercadopago] sync en Firestore con permiso insuficiente, devolviendo pagos al cliente:', (dbErr as Error).message);
        }
      }
      const incomingList = await classifyPayments(rawPayments);
      const recibidos = created.filter((p) => p.direction === 'recibido').length;
      // payments: la app guarda los que falten si el servidor no pudo (nunca pisa los ya registrados)
      res.json({ ok: true, nuevos: created.length, recibidos, enviados: created.length - recibidos, payments: incomingList });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // Saldo actual de la cuenta (para la tarjeta de Dinero del Inicio).
  // Mercado Pago no lo documenta para todas las cuentas: si responde error, la app muestra "—".
  app.get('/api/mercadopago/balance', requireOwner, async (_req, res) => {
    if (!isMercadoPagoConfigured()) return res.status(400).json({ error: 'Falta MP_ACCESS_TOKEN en los Secrets' });
    try {
      const me = await getMyAccount();
      if (!me) return res.status(502).json({ error: 'No se pudo leer tu cuenta de Mercado Pago' });
      const b = await mp(`/users/${encodeURIComponent(me.id)}/mercadopago_account/balance`);
      res.json({
        available: Number(b.available_balance) || 0,
        total: Number(b.total_amount) || 0,
        unavailable: Number(b.unavailable_balance) || 0,
        currency: b.currency_id === 'USD' ? 'USD' : 'ARS',
        at: new Date().toISOString(),
      });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/mercadopago/status', requireOwner, (_req, res) => {
    res.json({ configured: isMercadoPagoConfigured(), webhookSigned: Boolean(process.env.MP_WEBHOOK_SECRET) });
  });
}
