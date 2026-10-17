import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Prospect, ProspectEvent, ProspectingSettings } from '../types';
import { countryBoosts, normalizeInstagram, phoneKey, recycleDue } from './core';
import { TAKE_REASON_TEXT, takeFromPool } from './poolStore';
import { updateProspect } from './store';
import { getAuthHeaders } from '../utils/authAccess';

/** Lo que aprende la app de tus métricas + quiénes no quieren ser contactados. */
export function usePoolTakeOptions(prospects: Prospect[], events: ProspectEvent[]) {
  return useMemo(
    () => ({
      boosts: countryBoosts(prospects, events),
      blockedPhones: new Set(prospects.filter((p) => p.doNotContact && p.whatsapp).map((p) => phoneKey(p.whatsapp))),
    }),
    [prospects, events]
  );
}

/**
 * "Sumar más hoy" con estado: mientras trabaja muestra "Sumando…", y si falla dice por qué
 * (antes el error se tragaba y parecía que el botón no hacía nada).
 */
export function useAddMore(
  settings: ProspectingSettings,
  today: string,
  opts: { boosts?: Record<string, number>; blockedPhones?: Set<string> },
  onAdded?: () => void
) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const running = useRef(false);

  const addMore = useCallback(
    async (n: number) => {
      if (running.current || n <= 0) return;
      running.current = true;
      setBusy(true);
      setMessage(null);
      try {
        const res = await takeFromPool(n, settings, today, { ...opts, now: true });
        if (res.added > 0) setMessage({ kind: 'ok', text: `Listo: ${res.added} ${res.added === 1 ? 'contacto nuevo' : 'contactos nuevos'} para escribir hoy.` });
        else setMessage({ kind: 'error', text: res.reason ? TAKE_REASON_TEXT[res.reason] : 'No se sumó ningún contacto.' });
        onAdded?.();
      } catch (err) {
        setMessage({ kind: 'error', text: `No se pudo sumar: ${friendlyError(err)}` });
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [settings, today, opts, onAdded]
  );

  return { addMore, busy, message, clearMessage: () => setMessage(null) };
}

export function friendlyError(err: unknown): string {
  const msg = String((err as any)?.message || err || '');
  if (/permission|insufficient/i.test(msg)) return 'sin permiso en la base. Entrá con tu cuenta de Google autorizada.';
  if (/offline|network|unavailable|failed to fetch/i.test(msg)) return 'sin conexión. Revisá internet y probá de nuevo.';
  return msg.slice(0, 140) || 'error desconocido';
}

/** Los descartados sin respuesta vuelven a la lista a los 90 días, con el mensaje de "segunda chance". */
export function useRecycle(prospects: Prospect[] | null, today: string, onRecycled?: (n: number) => void) {
  const doneFor = useRef('');
  useEffect(() => {
    if (!prospects || doneFor.current === today) return;
    const due = recycleDue(prospects, today);
    doneFor.current = today;
    if (due.length === 0) return;
    const batch = writeBatch(db);
    due.forEach((p) =>
      batch.set(
        doc(db, 'prospects', p.id),
        {
          stage: 'nuevo',
          secondChance: true,
          recycleAfter: null,
          followUps: 0,
          plannedFirstContact: today,
          nextActionDate: today,
          convStep: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    );
    batch
      .commit()
      .then(() => onRecycled?.(due.length))
      .catch((err) => console.warn('Segunda chance:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects === null, today]);
}

export async function markDayStarted(today: string): Promise<void> {
  await setDoc(doc(db, 'settings', 'prospecting'), { dayStartedOn: today }, { merge: true });
}

async function postAI<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
  return data as T;
}

/** Frase personalizada con IA (lee su web). Guarda la frase y, si aparece, su Instagram. */
export async function generatePersonalLine(p: Prospect): Promise<string> {
  const data = await postAI<{ line: string; instagram?: string }>('/api/ai/prospect-line', {
    name: p.studio || p.name,
    category: p.segment || p.source,
    city: p.city,
    country: p.country,
    website: p.website,
  });
  const updates: Partial<Prospect> = { personalLine: data.line };
  if (data.instagram && !p.instagram) updates.instagram = normalizeInstagram(data.instagram);
  await updateProspect(p.id, updates);
  return data.line;
}

export async function generateVideoScript(p: Prospect): Promise<string> {
  const data = await postAI<{ script: string }>('/api/ai/audit-video-script', {
    name: p.name,
    studio: p.studio,
    city: p.city,
    country: p.country,
    website: p.website,
    instagram: p.instagram,
    audit: p.audit,
  });
  return data.script;
}
