import { describe, expect, it } from 'vitest';
import { activityEvent, buildDayLog, collectProspectEvents } from '../src/prospecting/dayLog';
import { applyAction, DEFAULT_PROSPECTING_SETTINGS } from '../src/prospecting/core';
import type { Prospect, ProspectEvent } from '../src/types';
const day = '2026-10-24';
const p = (over: Partial<Prospect> = {}): Prospect => ({ id: 'p1', name: 'Estudio Uno', stage: 'contactado', createdAt: day, followUps: 0, ...over });
const e = (over: Partial<ProspectEvent> = {}): ProspectEvent => ({ id: 'e1', prospectId: 'p1', type: 'first_contact', date: day, createdAt: '2026-10-24T15:30:00Z', ...over });
describe('registro diario de prospección', () => {
  it('separa personas contactadas de la cantidad de mensajes, sin perderlas cuando avanzan', () => {
    const log = buildDayLog([p({ stage: 'cliente' })], [e(), e({ id: 'e2', type: 'conversation_sent', createdAt: '2026-10-24T16:30:00Z' })], day);
    expect(log.sent).toHaveLength(1); expect(log.messages).toBe(2);
    expect(log.sent[0].events[0].id).toBe('e2');
  });
  it('conserva enviados aunque se registre que todavía no respondieron', () => {
    const log = buildDayLog([p()], [e(), e({ id: 'e2', type: 'no_reply' })], day);
    expect(log.sent).toHaveLength(1); expect(log.replies).toHaveLength(0);
  });
  it('no mezcla los mensajes de ayer con los de hoy', () => {
    const events = [e({ date: '2026-10-23' }), e({ id: 'e2', type: 'reply' })];
    expect(buildDayLog([p()], events, day).sent).toHaveLength(0);
    expect(buildDayLog([p()], events, day).replies).toHaveLength(1);
    expect(buildDayLog([p()], events, '2026-10-23').sent).toHaveLength(1);
  });
  it('cuenta una sola persona aunque responda varias veces', () => {
    expect(buildDayLog([p()], [e({ type: 'reply' }), e({ id: 'e2', type: 'conversation_reply' })], day).replies).toHaveLength(1);
  });
  it('recupera conversaciones anteriores usando el día de Argentina y sin duplicar el evento', () => {
    const prospect = p({ log: [
      { at: '2026-10-25T01:10:00Z', dir: 'out', text: 'Le hiciste la pregunta' },
      { at: '2026-10-24T15:30:00Z', dir: 'out', text: 'Le mandaste el primer mensaje' },
      { at: '2026-10-24T17:00:00Z', dir: 'out', text: 'No respondió' },
    ] });
    const log = buildDayLog([prospect], [e()], day);
    expect(log.messages).toBe(2); expect(log.sent).toHaveLength(1);
    expect(buildDayLog([prospect], [e()], '2026-10-25').messages).toBe(0);
  });
  it('distingue dos mensajes próximos del guion si tienen acciones diferentes', () => {
    const prospect = p({ log: [
      { at: '2026-10-24T15:30:00Z', dir: 'out', action: 'conv_question_sent', text: 'Le hiciste la pregunta' },
      { at: '2026-10-24T15:30:01Z', dir: 'out', action: 'conv_empathy_sent', text: 'Le mandaste la empatía' },
    ] });
    expect(buildDayLog([prospect], [], day).messages).toBe(2);
  });
  it('recupera el último envío antiguo sin inventar una hora o duplicarlo', () => {
    const prospect = p({ lastContactAt: day });
    expect(buildDayLog([prospect], [], day).sent[0].events[0].createdAt).toBe('');
    expect(buildDayLog([prospect], [e()], day).messages).toBe(1);
  });
  it('mantiene el nombre del evento si se elimina el prospecto', () => {
    expect(buildDayLog([], [e({ prospectName: 'Estudio Uno' })], day).sent[0].name).toBe('Estudio Uno');
  });
  it('registra guion, respuestas, notas y postergaciones sin inflar primeros contactos', () => {
    expect(activityEvent(p(), 'conv_question_sent', day)?.type).toBe('conversation_sent');
    expect(activityEvent(p(), 'i_replied', day)?.type).toBe('conversation_sent');
    expect(activityEvent(p(), 'they_replied', day)?.type).toBe('conversation_reply');
    expect(activityEvent(p(), 'snooze', day)?.type).toBe('deferred');
    expect(activityEvent(p(), 'note', day, 'Llamar el lunes')?.type).toBe('note');
    expect(activityEvent(p(), 'first_contact', day)).toBeNull();
  });
  it('al anotar una respuesta no retrocede la auditoría ni pierde el turno', () => {
    const r = applyAction(p({ stage: 'video_enviado' }), 'they_replied', day);
    expect(r.updates.stage).toBeUndefined(); expect(r.updates.awaitingMe).toBe(true);
  });
  it('la propuesta deja registrado el contacto y agenda su próximo seguimiento', () => {
    const r = applyAction(p({ stage: 'llamada' }), 'proposal_sent', day, DEFAULT_PROSPECTING_SETTINGS);
    expect(r.updates.lastContactAt).toBe(day); expect(r.updates.nextActionDate).toBe('2026-10-27');
  });
});
