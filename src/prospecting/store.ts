import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from '../utils/firestoreService';
import { Prospect, ProspectEvent, ProspectingSettings } from '../types';
import { ProspectAction, applyAction, logEntryFor, mergeProspectingSettings } from './core';

// Firestore de la prospección: prospects, prospect_events y settings/prospecting

export function subscribeProspects(onChanged: (items: Prospect[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'prospects'),
    (snap) => onChanged(snap.docs.map((d) => ({ followUps: 0, ...(d.data() as Prospect), id: d.id }))),
    (err) => {
      console.warn('subscribeProspects error:', err);
      onError?.(err);
    }
  );
}

export function subscribeProspectEvents(onChanged: (items: ProspectEvent[]) => void) {
  return onSnapshot(
    collection(db, 'prospect_events'),
    (snap) => onChanged(snap.docs.map((d) => ({ ...(d.data() as ProspectEvent), id: d.id }))),
    (err) => console.warn('subscribeProspectEvents error:', err)
  );
}

export function subscribeProspectingSettings(onChanged: (s: ProspectingSettings) => void) {
  return onSnapshot(
    doc(db, 'settings', 'prospecting'),
    (snap) => {
      const data = (snap.exists() ? snap.data() : {}) as Partial<ProspectingSettings>;
      onChanged(mergeProspectingSettings(data));
    },
    (err) => console.warn('subscribeProspectingSettings error:', err)
  );
}

export async function saveProspectingSettings(s: ProspectingSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'prospecting'), deepSanitize(s), { merge: true });
}

export async function saveProspects(items: Prospect[]): Promise<void> {
  const batch = writeBatch(db);
  items.forEach((p) => batch.set(doc(db, 'prospects', p.id), deepSanitize(p), { merge: true }));
  await batch.commit();
}

export async function updateProspect(id: string, updates: Partial<Prospect>): Promise<void> {
  // undefined = borrar el campo (ej.: nextActionDate al cerrar)
  const payload: Record<string, any> = {};
  Object.entries(updates).forEach(([k, v]) => (payload[k] = v === undefined ? null : v));
  await setDoc(doc(db, 'prospects', id), deepSanitize({ ...payload, updatedAt: new Date().toISOString() }), { merge: true });
}

export async function deleteProspect(id: string): Promise<void> {
  await deleteDoc(doc(db, 'prospects', id));
}

/** Registra lo que pasó con un prospecto: actualiza su etapa y guarda el evento (para las métricas). */
export async function recordProspectAction(
  p: Prospect,
  action: ProspectAction,
  today: string,
  settings: ProspectingSettings,
  note?: string
): Promise<Partial<Prospect>> {
  const { updates, event } = applyAction(p, action, today, settings, note);
  const batch = writeBatch(db);
  const payload: Record<string, any> = { updatedAt: new Date().toISOString() };
  Object.entries(updates).forEach(([k, v]) => (payload[k] = v === undefined ? null : v));
  const sanitized: Record<string, any> = deepSanitize(payload);
  // Historial de la conversación: se agrega, nunca se borra lo anterior
  const entry = logEntryFor(action, note);
  if (entry) sanitized.log = arrayUnion({ at: new Date().toISOString(), ...entry });
  batch.set(doc(db, 'prospects', p.id), sanitized, { merge: true });
  if (event) {
    const id = `pev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    batch.set(doc(db, 'prospect_events', id), deepSanitize({ ...event, id, createdAt: new Date().toISOString() }));
  }
  await batch.commit();
  return updates;
}

/**
 * Registra la acción y devuelve cómo deshacerla (para el "Deshacer" de 5 segundos después de
 * "Enviar por WhatsApp"): vuelve los campos a como estaban, borra el evento y la línea del historial.
 */
export async function recordWithUndo(
  p: Prospect,
  action: ProspectAction,
  today: string,
  settings: ProspectingSettings,
  note?: string
): Promise<() => Promise<void>> {
  const { updates, event } = applyAction(p, action, today, settings, note);
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  const payload: Record<string, any> = { updatedAt: nowIso };
  Object.entries(updates).forEach(([k, v]) => (payload[k] = v === undefined ? null : v));
  const sanitized: Record<string, any> = deepSanitize(payload);
  const entry = logEntryFor(action, note);
  const logItem = entry ? { at: nowIso, ...entry } : null;
  if (logItem) sanitized.log = arrayUnion(logItem);
  batch.set(doc(db, 'prospects', p.id), sanitized, { merge: true });
  let eventId: string | null = null;
  if (event) {
    eventId = `pev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    batch.set(doc(db, 'prospect_events', eventId), deepSanitize({ ...event, id: eventId, createdAt: nowIso }));
  }
  await batch.commit();

  // Lo de antes, para volver atrás
  const before: Record<string, any> = {};
  Object.keys(updates).forEach((k) => {
    const v = (p as any)[k];
    before[k] = v === undefined ? null : v;
  });
  return async () => {
    const undo = writeBatch(db);
    const restore: Record<string, any> = { ...before, updatedAt: new Date().toISOString() };
    if (logItem) restore.log = arrayRemove(logItem);
    undo.set(doc(db, 'prospects', p.id), restore, { merge: true });
    if (eventId) undo.delete(doc(db, 'prospect_events', eventId));
    await undo.commit();
  };
}

/** Mover a mano de columna (para corregir). Queda anotado en el historial. */
export async function moveProspect(p: Prospect, updates: Partial<Prospect>, label: string): Promise<void> {
  const payload: Record<string, any> = { updatedAt: new Date().toISOString() };
  Object.entries(updates).forEach(([k, v]) => (payload[k] = v === undefined ? null : v));
  const sanitized: Record<string, any> = deepSanitize(payload);
  sanitized.log = arrayUnion({ at: new Date().toISOString(), dir: 'nota', text: `Lo moviste a ${label}` });
  await setDoc(doc(db, 'prospects', p.id), sanitized, { merge: true });
}
