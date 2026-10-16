import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from '../utils/firestoreService';
import { Prospect, ProspectingSettings } from '../types';
import { PoolLead, PoolSegment, pickBatch } from './pool';
import { distributeFirstContacts } from './core';
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

export function prospectFromLead(lead: PoolLead, plannedFirstContact: string, today: string): Prospect {
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
  };
}

/**
 * Pasa los mejores de la reserva a prospección: crea los prospectos con su día de
 * primer mensaje y los marca como tomados (la reserva se va restando).
 * `firstDay` = desde qué día repartir; `perDay` = cuántos por día (con "sumar más hoy", todos hoy).
 */
export async function takeFromPool(
  count: number,
  settings: ProspectingSettings,
  today: string,
  opts: { firstDay?: string; perDay?: number } = {}
): Promise<number> {
  if (count <= 0) return 0;
  const available = (await loadPool()).filter((d) => d.status === 'disponible');
  const picked = pickBatch(available, count, {
    countries: settings.poolCountries,
    segments: settings.poolSegments as PoolSegment[],
  });
  if (picked.length === 0) return 0;
  const dates = distributeFirstContacts(picked.length, opts.firstDay || today, opts.perDay || settings.firstContactsPerDay);
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  picked.forEach((lead, i) => {
    const p = prospectFromLead(lead, dates[i], today);
    batch.set(doc(db, 'prospects', p.id), deepSanitize(p));
    batch.set(doc(db, POOL, lead.id), { status: 'tomado', takenAt: nowIso, prospectId: p.id }, { merge: true });
  });
  await batch.commit();
  return picked.length;
}

let weeklyRunning = false;

/**
 * Tanda automática: la primera vez que abrís la app en la semana, pasan
 * `weeklyBatchSize` contactos de la reserva a prospección. Una sola vez por semana.
 */
export async function maybeRunWeeklyBatch(settings: ProspectingSettings, today: string): Promise<number> {
  const monday = startOfWeekMonday(today);
  if (weeklyRunning || settings.weeklyBatchSize <= 0 || settings.lastBatchWeek === monday) return 0;
  weeklyRunning = true;
  try {
    // Se marca la semana primero: si otra pestaña lo intenta a la vez, no duplica la tanda
    await setDoc(doc(db, 'settings', 'prospecting'), { lastBatchWeek: monday }, { merge: true });
    return await takeFromPool(settings.weeklyBatchSize, settings, today);
  } finally {
    weeklyRunning = false;
  }
}
