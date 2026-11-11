import { Prospect } from '../types';
import { normalizeInstagram } from './core';

/**
 * Buscar a un prospecto cuando te contesta: por nombre, estudio, teléfono, @ de Instagram o ciudad.
 * Sin acentos ni mayúsculas; el teléfono se compara solo por sus números (con o sin +54, espacios o guiones).
 */

const plain = (s?: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const digits = (s?: string) => (s || '').replace(/\D/g, '');

/** Cuánto coincide (0 = no coincide). Más alto = mejor. */
export function matchScore(p: Prospect, query: string): number {
  const q = plain(query).replace(/^@/, '');
  if (!q) return 0;
  const words = q.split(/\s+/).filter(Boolean);
  const name = plain(p.name);
  const studio = plain(p.studio);
  const ig = plain(p.instagram ? normalizeInstagram(p.instagram) : '');
  const city = plain(p.city);
  const hay = `${name} ${studio} ${ig} ${city}`;

  let score = 0;
  if (words.every((w) => hay.includes(w))) {
    score = 10;
    if (name.startsWith(q) || studio.startsWith(q) || ig.startsWith(q)) score += 20;
    else if (`${name} ${studio}`.split(/\s+/).some((w) => w.startsWith(words[0]))) score += 10;
  }
  // Teléfono: alcanza con los últimos números que ves en WhatsApp
  const qd = digits(query);
  if (qd.length >= 4 && digits(p.whatsapp).includes(qd)) score = Math.max(score, 25);
  if (!score) return 0;
  // A igual coincidencia, primero con quien ya hay conversación
  if (p.awaitingMe) score += 3;
  if (p.lastContactAt) score += 2;
  return score;
}

export function findProspects(prospects: Prospect[], query: string, limit = 8): Prospect[] {
  return prospects
    .map((p) => ({ p, s: matchScore(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.p.lastContactAt || '').localeCompare(a.p.lastContactAt || '') || (a.p.studio || a.p.name).localeCompare(b.p.studio || b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
}

/** Sin buscar nada: los últimos a los que les escribiste y todavía no contestaron (de ahí suele venir la respuesta). */
export function recentlyContacted(prospects: Prospect[], limit = 5): Prospect[] {
  return prospects
    .filter((p) => p.lastContactAt && !p.awaitingMe && !p.doNotContact && !['cliente', 'descartado'].includes(p.stage))
    .sort((a, b) => (b.lastContactAt || '').localeCompare(a.lastContactAt || ''))
    .slice(0, limit);
}
