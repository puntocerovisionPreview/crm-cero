import { DifusionKey, Prospect, ProspectingSettings } from '../types';
import { addDays } from '../utils/dates';
import {
  DEFAULT_PROSPECTING_SETTINGS,
  DIFUSION_LABELS,
  ProspectAction,
  QueueItem,
  isHot,
  localTimeFor,
  renderTemplate,
  templateFor,
} from './core';

/**
 * PROSPECCIÓN EN 5 COLUMNAS (lógica pura)
 *
 * Por escribir → Esperando respuesta → Conversando → Auditoría → Llamada → (Cliente / Perdido)
 *
 * Cada prospecto tiene UNA cosa para hacer ("nextMove"). Mandar el mensaje desde la app ya lo
 * marca como enviado; lo único que hay que avisar a mano es "Respondió".
 * Las etapas internas de antes (paso del guion, video, propuesta) siguen existiendo por
 * dentro para los mensajes y las métricas, pero no hace falta pensarlas.
 */

export type BoardColumn = 'por_escribir' | 'esperando' | 'conversando' | 'auditoria' | 'llamada';
export type ClosedColumn = 'cliente' | 'perdido';

export const BOARD_COLUMNS: { id: BoardColumn; label: string; hint: string }[] = [
  { id: 'por_escribir', label: 'Por escribir', hint: 'Todavía no les escribiste' },
  { id: 'esperando', label: 'Esperando respuesta', hint: 'Les escribiste y no contestaron' },
  { id: 'conversando', label: 'Conversando', hint: 'Te respondieron: guion hasta el link' },
  { id: 'auditoria', label: 'Auditoría', hint: 'Link, auditoría y video' },
  { id: 'llamada', label: 'Llamada', hint: 'Llamada y propuesta' },
];

export function columnOf(p: Prospect): BoardColumn | ClosedColumn {
  switch (p.stage) {
    case 'nuevo':
      return 'por_escribir';
    case 'contactado':
      return 'esperando';
    case 'respondio':
      return 'conversando';
    case 'auditoria_enviada':
    case 'auditoria_completada':
    case 'video_enviado':
      return 'auditoria';
    case 'llamada':
      return 'llamada';
    case 'cliente':
      return 'cliente';
    default:
      return 'perdido';
  }
}

export interface Choice {
  label: string;
  action: ProspectAction;
  note?: string;
}

export interface NextMove {
  title: string; // qué hacer, corto
  why: string; // qué pasó
  message: string; // el mensaje listo ('' si no hay)
  send?: ProspectAction; // lo que se registra al tocar "Enviar por WhatsApp"
  sendLabel: string;
  choose?: Choice[]; // opciones de un toque
  need?: 'video' | 'call_time' | 'call_outcome';
  waiting: boolean; // le toca a él: no hay nada para hacer ya
  canReply: boolean; // mostrar "Respondió"
  due: boolean; // tiene que aparecer hoy
}

const ago = (d: string | undefined, today: string) => {
  if (!d) return '';
  const n = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
};

function callPassed(p: Prospect, today: string, now: Date): boolean {
  if (!p.callDate) return false;
  if (p.callDate < today) return true;
  if (p.callDate > today || !p.callTime) return false;
  const [h, m] = p.callTime.split(':').map(Number);
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Cordoba' }));
  return local.getHours() * 60 + local.getMinutes() >= h * 60 + m + 30;
}

/** El mensaje que corresponde, usando las mismas plantillas de siempre. */
function msg(p: Prospect, kind: QueueItem['kind'], settings: ProspectingSettings): string {
  const item: QueueItem = { prospect: p, kind, overdueDays: 0, suggestDiscard: false, hot: isHot(p) };
  return renderTemplate(templateFor(item, settings), p, settings);
}

/** Lo próximo para hacer con este prospecto. */
export function nextMove(
  p: Prospect,
  today: string,
  settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS,
  now: Date = new Date()
): NextMove {
  const dueNow = (p.nextActionDate || today) <= today;
  const said = p.lastReplyNote ? ` Te dijo: «${p.lastReplyNote}».` : '';
  const step = p.convStep || 'pregunta';
  const base = { sendLabel: 'Enviar por WhatsApp', waiting: false, canReply: false, due: true, message: '' };
  const followUp = (what: string): NextMove => {
    const n = Math.min((p.followUps || 0) + 1, settings.maxFollowUps);
    const done = (p.followUps || 0) >= settings.maxFollowUps;
    if (!dueNow) return { ...base, title: 'Esperando respuesta', why: `${what} Le escribiste ${ago(p.lastContactAt, today)}.`, waiting: true, canReply: true, due: false };
    return {
      ...base,
      title: done ? 'No respondió a ningún seguimiento' : `Mandale un recordatorio (${n} de ${settings.maxFollowUps})`,
      why: `${what} Le escribiste ${ago(p.lastContactAt, today)}.`,
      message: msg(p, 'seguimiento', settings),
      send: 'follow_up',
      sendLabel: done ? 'Mandar uno más' : 'Enviar por WhatsApp',
      choose: done ? [{ label: 'Dar por perdido', action: 'lost', note: 'Sin respuesta tras los seguimientos' }] : undefined,
      canReply: true,
    };
  };

  switch (p.stage) {
    case 'nuevo':
      return {
        ...base,
        title: p.secondChance ? 'Volvé a escribirle (pasaron 3 meses)' : 'Mandale el primer mensaje',
        why: p.secondChance ? 'No había respondido; segunda oportunidad.' : 'Todavía no le escribiste.',
        message: msg(p, 'primer', settings),
        send: 'first_contact',
        due: (p.plannedFirstContact || p.createdAt) <= today,
      };

    case 'contactado':
      if (p.awaitingMe) break; // (te respondió: se maneja abajo)
      return followUp('Le mandaste el primer mensaje y no respondió.');

    case 'respondio': {
      if (step === 'pregunta')
        return { ...base, title: 'Hacele la pregunta', why: `Te respondió.${said}`, message: msg(p, 'responder', settings), send: 'conv_question_sent' };
      if (step === 'esperando_respuesta') {
        if (!p.awaitingMe) return followUp('Le hiciste la pregunta y no contestó.');
        return {
          ...base,
          title: '¿Cómo consigue clientes hoy?',
          why: `Te contestó la pregunta.${said} Tocá lo que te dijo y te armo la respuesta.`,
          choose: (Object.keys(DIFUSION_LABELS) as DifusionKey[]).map((k) => ({ label: DIFUSION_LABELS[k], action: `conv_answer:${k}` as ProspectAction })),
        };
      }
      if (step === 'empatia')
        return {
          ...base,
          title: 'Mandale la empatía',
          why: `Te contó que consigue clientes por ${DIFUSION_LABELS[p.difusion || 'otro'].toLowerCase()}.`,
          message: msg(p, 'responder', settings),
          send: 'conv_empathy_sent',
        };
      if (step === 'esperando_acuerdo' && !p.awaitingMe) return followUp('Le mandaste la empatía y no contestó.');
      // Coincidió (o ya estaba en el speech): mandar el diagnóstico con su link
      return {
        ...base,
        title: 'Pasale el diagnóstico gratis',
        why: step === 'speech' ? 'Coincidió con lo que le dijiste.' : `Te respondió la empatía.${said}`,
        message: renderTemplate(settings.templates.speech || settings.templates.audit, p, settings),
        send: 'audit_sent',
        sendLabel: 'Enviar el link por WhatsApp',
        choose: [{ label: 'No le interesa', action: 'lost', note: 'No le interesa' }],
      };
    }

    case 'auditoria_enviada':
      if (p.awaitingMe) break;
      return followUp('Le pasaste el link de la auditoría y todavía no la completó.');

    case 'auditoria_completada':
      return {
        ...base,
        title: p.videoUrl ? 'Mandale el video' : 'Grabale el video de la auditoría',
        why: `Completó la auditoría (${p.audit?.total ?? '—'}/30).${p.videoDueDate ? ` Tenés hasta el ${p.videoDueDate.slice(8, 10)}/${p.videoDueDate.slice(5, 7)}.` : ''}`,
        message: p.videoUrl ? msg(p, 'video', settings) : '',
        send: p.videoUrl ? 'video_sent' : undefined,
        need: p.videoUrl ? undefined : 'video',
      };

    case 'video_enviado':
      if (p.awaitingMe) break;
      return { ...followUp('Le mandaste el video y no agendó la llamada.'), choose: [{ label: 'Agendó la llamada', action: 'call' }] };

    case 'llamada':
      if (p.awaitingMe) break;
      if (p.proposalSentAt) {
        const f = followUp('Le mandaste la propuesta.');
        return {
          ...f,
          message: f.message ? msg(p, 'propuesta', settings) : '',
          title: f.waiting ? 'Esperando respuesta a la propuesta' : 'Preguntale por la propuesta',
          choose: [
            { label: 'Aceptó: es cliente', action: 'won' },
            { label: 'No se dio', action: 'lost', note: 'No aceptó la propuesta' },
          ],
        };
      }
      if (!p.callDate || !p.callTime)
        return { ...base, title: 'Ponele día y hora a la llamada', why: 'Quedó agendada sin horario.', need: 'call_time' };
      if (!callPassed(p, today, now)) {
        const day = p.callDate === today ? 'hoy' : p.callDate === addDays(today, 1) ? 'mañana' : `el ${p.callDate.slice(8, 10)}/${p.callDate.slice(5, 7)}`;
        return { ...base, title: `Llamada ${day} a las ${p.callTime}`, why: 'Preparala con lo que sabés de él.', waiting: true, due: p.callDate === today };
      }
      return {
        ...base,
        title: '¿Cómo salió la llamada?',
        why: `La llamada era ${ago(p.callDate, today)}.`,
        need: 'call_outcome',
        choose: [
          { label: 'Le mandé la propuesta', action: 'proposal_sent' },
          { label: 'Es cliente', action: 'won' },
          { label: 'No se dio', action: 'lost', note: 'No se dio en la llamada' },
        ],
      };
  }

  // Te escribió fuera del guion (después del link, del video o de la propuesta)
  return {
    ...base,
    title: 'Contestale',
    why: `Te escribió ${ago(p.lastReplyAt, today)}.${said}`,
    send: 'i_replied',
    sendLabel: 'Contestar por WhatsApp',
    choose: p.stage === 'contactado' ? undefined : [{ label: 'Agendamos llamada', action: 'call' }],
  };
}

/** Lo que cambia al mover a mano una tarjeta a otra columna (para corregir). */
export function moveUpdates(p: Prospect, to: BoardColumn | ClosedColumn, today: string, settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS): Partial<Prospect> {
  const next = addDays(today, settings.followUpDays);
  switch (to) {
    case 'por_escribir':
      return { stage: 'nuevo', plannedFirstContact: today, nextActionDate: today, convStep: undefined, awaitingMe: false };
    case 'esperando':
      return { stage: 'contactado', lastContactAt: p.lastContactAt || today, nextActionDate: next, convStep: undefined, awaitingMe: false };
    case 'conversando':
      return { stage: 'respondio', convStep: p.stage === 'respondio' ? p.convStep : 'pregunta', awaitingMe: true, nextActionDate: today, lastReplyAt: today };
    case 'auditoria':
      return ['auditoria_enviada', 'auditoria_completada', 'video_enviado'].includes(p.stage)
        ? {}
        : { stage: 'auditoria_enviada', convStep: undefined, awaitingMe: false, lastContactAt: today, nextActionDate: next, followUps: 0 };
    case 'llamada':
      return p.stage === 'llamada' ? {} : { stage: 'llamada', awaitingMe: false, nextActionDate: undefined, proposalSentAt: undefined };
    case 'cliente':
      return { stage: 'cliente', nextActionDate: undefined, awaitingMe: false };
    case 'perdido':
      return { stage: 'descartado', nextActionDate: undefined, awaitingMe: false, lostReason: p.lostReason || 'Descartado a mano' };
  }
}

/** Color de turno: verde te toca, gris esperando, ámbar sin respuesta. */
export function turnTone(p: Prospect, move: NextMove, settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS): 'mio' | 'suyo' | 'frio' {
  if (move.waiting) return 'suyo';
  if (move.send === 'follow_up' && (p.followUps || 0) >= settings.maxFollowUps) return 'frio';
  if (move.send === 'follow_up') return 'suyo';
  return 'mio';
}

/** Hora local en su país (para no escribir de madrugada). */
export { localTimeFor };
