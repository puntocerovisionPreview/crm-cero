import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from '../utils/firestoreService';
import { Prospect, ProspectingSettings } from '../types';
import { PoolLead, PoolSegment, pickBatch } from './pool';
import { distributeFirstContacts, phoneKey } from './core';
import { startOfWeekMonday } from '../utils/dates';

/**
 * Reserva en Firestore (colección prospect_pool). No se escucha en vivo (pueden ser miles):
 * se lee cuando hace falta (contar, tomar la tanda).
 * Cada contacto queda 'disponible' hasta que pasa a prospección ('tomado').
 */

const POOL = 'prospect_pool';

export interface PoolDoc extends PoolLead {
  status: 'disponible' | 'tomado';
  addedAt: string;
  takenAt?: string;
  prospectId?: string;
}

export async function loadPool(): Promise<PoolDoc[]> {
  const snap = await getDocs(collection(db, POOL));
  return snap.docs.map((d) => ({ ...(d.data() as PoolDoc), id: d.id }));
}

async function commitChunks(ops: Array<(b: ReturnType<typeof writeBatch>) => void>) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

/** Agrega a la reserva solo los que no estaban (no reactiva los que ya se tomaron). */
export async function addToPool(leads: PoolLead[], today: string): Promise<number> {
  const existing = new Set((await loadPool()).map((d) => d.id));
  const fresh = leads.filter((l) => !existing.has(l.id));
  await commitChunks(
    fresh.map((l) => (b) => b.set(doc(db, POOL, l.id), deepSanitize({ ...l, status: 'disponible', addedAt: today })))
  );
  return fresh.length;
}

export function prospectFromLead(lead: PoolLead, plannedFirstContact: string, today: string, pulledOn?: string): Prospect {
  return {
    id: `pros_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: lead.name,
    studio: lead.name,
    whatsapp: `+${lead.whatsapp}`,
    instagram: lead.instagram,
    city: lead.city,
    country: lead.country,
    website: lead.website,
    segment: lead.segment,
    score: lead.score,
    poolId: lead.id,
    source: `Reserva — ${lead.category} (${lead.countryName})`,
    stage: 'nuevo',
    createdAt: today,
    plannedFirstContact,
    nextActionDate: plannedFirstContact,
    followUps: 0,
    pulledOn,
  };
}

export interface TakeResult {
  added: number;
  /** por qué no se sumó nada (para mostrarlo en pantalla) */
  reason?: 'reserva_vacia' | 'sin_coincidencias';
}

/**
 * Pasa los mejores de la reserva a prospección: crea los prospectos con su día de
 * primer mensaje y los marca como tomados (la reserva se va restando).
 * - `now: true` ("sumar más hoy"): todos para HOY, aunque sea fin de semana, y entran a la
 *   lista aunque se pase el tope diario.
 * - si no: se reparten en tus días de trabajo, `firstContactsPerDay` por día.
 * `blockedPhones`: teléfonos de quienes pidieron no ser contactados.
 */
export async function takeFromPool(
  count: number,
  settings: ProspectingSettings,
  today: string,
  opts: { now?: boolean; boosts?: Record<string, number>; blockedPhones?: Set<string> } = {}
): Promise<TakeResult> {
  if (count <= 0) return { added: 0 };
  const available = (await loadPool()).filter(
    (d) => d.status === 'disponible' && !(opts.blockedPhones && opts.blockedPhones.has(phoneKey(d.whatsapp)))
  );
  if (available.length === 0) return { added: 0, reason: 'reserva_vacia' };
  let picked = pickBatch(available, count, {
    countries: settings.poolCountries,
    segments: settings.poolSegments as PoolSegment[],
    boosts: opts.boosts,
  });
  // Si los filtros de país/rubro dejan sin nada y es "sumar más hoy", toma de toda la reserva
  if (picked.length === 0 && opts.now) picked = pickBatch(available, count, { boosts: opts.boosts });
  if (picked.length === 0) return { added: 0, reason: 'sin_coincidencias' };
  const dates = opts.now
    ? picked.map(() => today)
    : distributeFirstContacts(picked.length, today, settings.firstContactsPerDay, settings.workDays);
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  picked.forEach((lead, i) => {
    const p = prospectFromLead(lead, dates[i], today, opts.now ? today : undefined);
    batch.set(doc(db, 'prospects', p.id), deepSanitize(p));
    batch.set(doc(db, POOL, lead.id), { status: 'tomado', takenAt: nowIso, prospectId: p.id }, { merge: true });
  });
  await batch.commit();
  return { added: picked.length };
}

export const TAKE_REASON_TEXT: Record<NonNullable<TakeResult['reason']>, string> = {
  reserva_vacia: 'La reserva está vacía: subí el CSV del scraper en la pestaña Reserva.',
  sin_coincidencias: 'Ningún contacto de la reserva coincide con los países o rubros elegidos. Cambialos en Reserva.',
};

let weeklyRunning = false;

/**
 * Tanda automática: la primera vez que abrís la app en la semana, pasan
 * `weeklyBatchSize` contactos de la reserva a prospección. Una sola vez por semana.
 */
export async function maybeRunWeeklyBatch(
  settings: ProspectingSettings,
  today: string,
  opts: { boosts?: Record<string, number>; blockedPhones?: Set<string> } = {}
): Promise<number> {
  const monday = startOfWeekMonday(today);
  if (weeklyRunning || settings.weeklyBatchSize <= 0 || settings.lastBatchWeek === monday) return 0;
  weeklyRunning = true;
  try {
    const res = await takeFromPool(settings.weeklyBatchSize, settings, today, opts);
    // Solo se marca la semana si se sumó algo: con la reserva vacía, vuelve a intentar
    // cuando subas el CSV (antes quedaba marcada y no sumaba nada en toda la semana)
    if (res.added > 0) await setDoc(doc(db, 'settings', 'prospecting'), { lastBatchWeek: monday }, { merge: true });
    return res.added;
  } finally {
    weeklyRunning = false;
  }
}
