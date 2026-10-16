import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from '../utils/firestoreService';
import { Prospect, ProspectEvent, ProspectingSettings } from '../types';
import { DEFAULT_PROSPECTING_SETTINGS, ProspectAction, applyAction } from './core';

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
      onChanged({
        ...DEFAULT_PROSPECTING_SETTINGS,
        ...data,
        templates: { ...DEFAULT_PROSPECTING_SETTINGS.templates, ...(data.templates || {}) },
      });
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
  batch.set(doc(db, 'prospects', p.id), deepSanitize(payload), { merge: true });
  if (event) {
    const id = `pev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    batch.set(doc(db, 'prospect_events', id), deepSanitize({ ...event, id, createdAt: new Date().toISOString() }));
  }
  await batch.commit();
  return updates;
}
