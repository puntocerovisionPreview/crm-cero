import { addDays } from '../utils/dates';
import { ContentPiece, SUPPORT_LABEL, isLate, pieceTitle, statusStage } from './model';

/**
 * AVISOS DE CONTENIDO
 * A la mañana: qué se publica hoy (y si algo de días anteriores quedó sin publicar).
 * A la tarde: qué toca mañana y qué conviene dejar listo hoy.
 * Lógica pura: el servidor la usa con las piezas de content_pieces.
 */

export interface ContentNotice {
  title: string;
  body: string;
}

const byOrder = (a: ContentPiece, b: ContentPiece) => (a.number || 0) - (b.number || 0);
const pending = (p: ContentPiece) => statusStage(p.status) !== 'publicado';

/** Qué falta para que la pieza esté lista, en criollo */
export function readinessNote(p: ContentPiece): string {
  const st = statusStage(p.status);
  if (st === 'listo') return 'lista para publicar';
  if (st === 'revisar') return p.support === 'carrusel' ? 'falta revisar las slides' : 'falta revisarla';
  if (st === 'produccion') return p.support === 'reel' ? 'grabado, falta editar' : 'en producción';
  if (st === 'guion') return p.support === 'reel' ? 'falta grabar y editar' : 'falta diseñarla';
  return 'todavía es una idea';
}

function line(p: ContentPiece): string {
  const kw = p.resources.map((r) => r.word).filter(Boolean);
  const parts = [`• ${SUPPORT_LABEL[p.support]}: ${pieceTitle(p)}`];
  if (p.slides.length > 1) parts.push(`(${p.slides.length} slides)`);
  const extra = [readinessNote(p), kw.length ? `palabra clave ${kw.join(', ')}` : ''].filter(Boolean).join(' · ');
  return `${parts.join(' ')}\n   ${extra}`;
}

export function contentMorningNotice(pieces: ContentPiece[], today: string): ContentNotice | null {
  const todays = pieces.filter((p) => p.date === today && pending(p)).sort(byOrder);
  const late = pieces.filter((p) => isLate(p, today) && p.date >= addDays(today, -7));
  if (!todays.length && !late.length) return null;
  const lines: string[] = [];
  if (todays.length) {
    lines.push(...todays.map(line));
    if (todays.some((p) => p.caption)) lines.push('El caption está en la app, listo para copiar.');
  }
  if (late.length) lines.push(`${todays.length ? '\n' : ''}Sin marcar publicada: ${late.map((p) => pieceTitle(p)).join(', ')}. Si ya salió, cambiale el estado.`);
  const title = todays.length
    ? `📣 Hoy se publica: ${todays.length === 1 ? pieceTitle(todays[0]) : `${todays.length} piezas`}`
    : `📣 ${late.length === 1 ? 'Quedó 1 pieza' : `Quedaron ${late.length} piezas`} sin publicar`;
  return { title, body: lines.join('\n') };
}

export function contentEveningNotice(pieces: ContentPiece[], today: string): ContentNotice | null {
  const tomorrow = addDays(today, 1);
  const list = pieces.filter((p) => p.date === tomorrow && pending(p)).sort(byOrder);
  if (!list.length) return null;
  const notReady = list.filter((p) => statusStage(p.status) !== 'listo');
  const lines = list.map(line);
  if (notReady.length) lines.push(`\nDejalo listo hoy: ${notReady.map((p) => `${pieceTitle(p)} (${readinessNote(p)})`).join('; ')}.`);
  return {
    title: `🗓️ Mañana toca: ${list.length === 1 ? pieceTitle(list[0]) : `${list.length} piezas`}`,
    body: lines.join('\n'),
  };
}
