import type { Prospect, ProspectEvent, ProspectEventType } from '../types';
import type { ProspectAction } from './core';

export const SENT_EVENT_TYPES = new Set<ProspectEventType>([
  'first_contact', 'follow_up', 'audit_sent', 'video_sent', 'proposal_sent', 'conversation_sent',
]);
const REPLY_TYPES = new Set<ProspectEventType>(['reply', 'conversation_reply']);
export const EVENT_LABELS: Record<ProspectEventType, string> = {
  first_contact: 'Primer mensaje enviado', follow_up: 'Seguimiento enviado',
  audit_sent: 'Diagnóstico enviado', video_sent: 'Video enviado', proposal_sent: 'Propuesta enviada',
  conversation_sent: 'Mensaje de conversación enviado', conversation_reply: 'Respuesta registrada',
  reply: 'Respondió', no_reply: 'Todavía sin respuesta', audit_completed: 'Diagnóstico completado',
  call: 'Llamada agendada', call_rescheduled: 'Llamada reprogramada',
  won: 'Venta cerrada', lost: 'Contacto cerrado', deferred: 'Pasado a mañana', note: 'Nota',
};

/** Completa las acciones que antes cambiaban el contacto sin dejar rastro diario. */
export function activityEvent(p: Prospect, action: ProspectAction, date: string, note?: string): Omit<ProspectEvent, 'id' | 'createdAt'> | null {
  let type: ProspectEventType;
  if (['chatting', 'i_replied', 'conv_question_sent', 'conv_empathy_sent'].includes(action)) type = 'conversation_sent';
  else if (action === 'they_replied' || action === 'conv_agreed' || action.startsWith('conv_answer:')) type = 'conversation_reply';
  else if (action === 'snooze') type = 'deferred';
  else if (action === 'call') type = 'call_rescheduled';
  else if (action === 'note' && note) type = 'note';
  else return null;
  return { prospectId: p.id, type, date, action, note };
}

export interface DayContact {
  id: string;
  name: string;
  prospect?: Prospect;
  events: ProspectEvent[];
  sent: boolean;
  replied: boolean;
}

const LOCAL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
const LEGACY_MESSAGES = /^(Le mandaste el primer mensaje|Le mandaste un seguimiento|Le contestaste|Le hiciste la pregunta|Le mandaste la empatía|Le pasaste el link de la auditoría|Le mandaste el video|Le mandaste la propuesta)(?:$|:)/;
const LEGACY_EVENT_TYPES: [string, ProspectEventType][] = [
  ['Le mandaste el primer mensaje', 'first_contact'], ['Le mandaste un seguimiento', 'follow_up'],
  ['Le pasaste el link de la auditoría', 'audit_sent'], ['Le mandaste el video', 'video_sent'],
  ['Le mandaste la propuesta', 'proposal_sent'],
];
const LEGACY_REPLIES = /^(Te respondió|Te escribió|Te contó cómo difunde|Coincidió con lo que le dijiste)(?:$|:)/;

/** Une eventos y bitácoras anteriores sin contar dos veces el mismo mensaje. */
export function collectProspectEvents(prospects: Prospect[], events: ProspectEvent[]): ProspectEvent[] {
  const result = events.slice();
  const sentDays = new Set(events.filter(e => SENT_EVENT_TYPES.has(e.type)).map(e => e.prospectId + ':' + e.date));
  const replyDays = new Set(events.filter(e => REPLY_TYPES.has(e.type)).map(e => e.prospectId + ':' + e.date));
  const matchedEvents = new Set<string>();
  const byDay = new Map<string, ProspectEvent[]>();
  events.forEach(e => { const key = e.prospectId + ':' + e.date; const bucket = byDay.get(key) || []; bucket.push(e); byDay.set(key, bucket); });
  prospects.forEach(p => {
    (p.log || []).forEach((l, index) => {
      if (!Number.isFinite(Date.parse(l.at))) return;
      const date = LOCAL_DATE.format(new Date(l.at));
      const type: ProspectEventType | undefined = l.action
        ? ({ first_contact: 'first_contact', follow_up: 'follow_up', audit_sent: 'audit_sent', video_sent: 'video_sent', proposal_sent: 'proposal_sent', reply: 'reply', no_reply: 'no_reply', won: 'won', lost: 'lost', audit_completed: 'audit_completed', do_not_contact: 'lost', call: 'call' } as Record<string, ProspectEventType>)[l.action] || activityEvent(p, l.action as ProspectAction, date, l.text)?.type
        : LEGACY_EVENT_TYPES.find(([prefix]) => l.text === prefix || l.text.startsWith(prefix + ':'))?.[1] || (LEGACY_MESSAGES.test(l.text) ? 'conversation_sent' : LEGACY_REPLIES.test(l.text) ? 'conversation_reply' : l.dir === 'nota' ? 'note' : undefined);
      if (!type) return;
      if (SENT_EVENT_TYPES.has(type)) sentDays.add(p.id + ':' + date);
      if (REPLY_TYPES.has(type)) replyDays.add(p.id + ':' + date);
      // Same prospect, timestamp and compatible category. Old log entries lack action/type.
      const match = (byDay.get(p.id + ':' + date) || []).find(e => !matchedEvents.has(e.id) && (!l.action || !e.action || e.action === l.action)
        && Math.abs(Date.parse(e.createdAt) - Date.parse(l.at)) < 2000
        && (e.type === type || (l.action === 'call' && e.type === 'call_rescheduled') || (!l.action && ((SENT_EVENT_TYPES.has(type) && SENT_EVENT_TYPES.has(e.type)) || (REPLY_TYPES.has(type) && REPLY_TYPES.has(e.type))))));
      if (match) matchedEvents.add(match.id);
      if (!match) result.push({ id: 'log_' + p.id + '_' + index, prospectId: p.id, prospectName: p.studio || p.name,
        type, date, createdAt: l.at, action: l.action, note: l.text });
    });
    if (p.lastContactAt && !sentDays.has(p.id + ':' + p.lastContactAt)) {
      result.push({ id: 'legacy_' + p.id + '_' + p.lastContactAt, prospectId: p.id, prospectName: p.studio || p.name,
        type: 'conversation_sent', date: p.lastContactAt, createdAt: '', note: 'Registro anterior sin hora de envío' });
    }
    if (p.lastReplyAt && !replyDays.has(p.id + ':' + p.lastReplyAt)) {
      result.push({ id: 'legacy_reply_' + p.id + '_' + p.lastReplyAt, prospectId: p.id, prospectName: p.studio || p.name,
        type: 'conversation_reply', date: p.lastReplyAt, createdAt: '', note: 'Respuesta anterior sin hora registrada' });
    }
  });
  return result;
}

/** Usa la fecha de cada evento: el estado actual nunca reescribe días anteriores. */
export function buildDayLog(prospects: Prospect[], events: ProspectEvent[], date: string) {
  const byId = new Map(prospects.map(p => [p.id, p]));
  const daily = collectProspectEvents(prospects, events).filter(e => e.date === date);
  daily.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const contacts = new Map<string, DayContact>();
  daily.forEach(e => {
    const p = byId.get(e.prospectId);
    const row: DayContact = contacts.get(e.prospectId) || {
      id: e.prospectId, name: e.prospectName || p?.studio || p?.name || 'Contacto eliminado',
      prospect: p, events: [], sent: false, replied: false,
    };
    row.events.push(e);
    row.sent ||= SENT_EVENT_TYPES.has(e.type);
    row.replied ||= REPLY_TYPES.has(e.type);
    contacts.set(row.id, row);
  });
  const all = [...contacts.values()];
  return {
    all, sent: all.filter(c => c.sent), replies: all.filter(c => c.replied),
    messages: daily.filter(e => SENT_EVENT_TYPES.has(e.type)).length,
    firstContacts: new Set(daily.filter(e => e.type === 'first_contact').map(e => e.prospectId)).size,
    followUps: new Set(daily.filter(e => e.type === 'follow_up').map(e => e.prospectId)).size,
  };
}
