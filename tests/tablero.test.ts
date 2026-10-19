import { describe, expect, it } from 'vitest';
import { columnOf, moveUpdates, nextMove, turnTone } from '../src/prospecting/board';
import { applyAction, DEFAULT_PROSPECTING_SETTINGS as S } from '../src/prospecting/core';

const T = '2026-10-19';
const P = (over: any) => ({ id: over.id || 'p', name: 'Estudio Sur', studio: 'Estudio Sur', stage: 'nuevo', createdAt: '2026-10-12', followUps: 0, ...over }) as any;

describe('5 columnas', () => {
  it('cada etapa cae en su columna', () => {
    expect(columnOf(P({ stage: 'nuevo' }))).toBe('por_escribir');
    expect(columnOf(P({ stage: 'contactado' }))).toBe('esperando');
    expect(columnOf(P({ stage: 'respondio', convStep: 'esperando_acuerdo' }))).toBe('conversando');
    expect(columnOf(P({ stage: 'video_enviado' }))).toBe('auditoria');
    expect(columnOf(P({ stage: 'llamada' }))).toBe('llamada');
    expect(columnOf(P({ stage: 'descartado' }))).toBe('perdido');
  });
});

describe('lo próximo de cada uno', () => {
  it('nuevo: primer mensaje, y al mandarlo pasa a esperando', () => {
    const p = P({ plannedFirstContact: T });
    const m = nextMove(p, T, S);
    expect(m).toMatchObject({ send: 'first_contact', due: true, waiting: false });
    expect(m.message).toContain('?');
    const after = { ...p, ...applyAction(p, m.send!, T, S).updates };
    expect(columnOf(after)).toBe('esperando');
    expect(nextMove(after, T, S)).toMatchObject({ waiting: true, canReply: true });
  });

  it('respondió → pregunta → (respondió) elegir cómo difunde → empatía → (respondió) link', () => {
    let p = P({ stage: 'contactado', lastContactAt: '2026-10-17', nextActionDate: '2026-10-21' });
    p = { ...p, ...applyAction(p, 'they_replied', T, S).updates };
    expect(nextMove(p, T, S)).toMatchObject({ title: 'Hacele la pregunta', send: 'conv_question_sent' });
    p = { ...p, ...applyAction(p, 'conv_question_sent', T, S).updates };
    expect(nextMove(p, T, S).waiting).toBe(true);
    p = { ...p, ...applyAction(p, 'they_replied', T, S).updates };
    expect(nextMove(p, T, S).choose?.length).toBeGreaterThan(5);
    p = { ...p, ...applyAction(p, 'conv_answer:portales', T, S).updates };
    expect(nextMove(p, T, S)).toMatchObject({ send: 'conv_empathy_sent' });
    p = { ...p, ...applyAction(p, 'conv_empathy_sent', T, S).updates };
    p = { ...p, ...applyAction(p, 'they_replied', T, S).updates };
    const m = nextMove(p, T, S);
    expect(m).toMatchObject({ send: 'audit_sent' });
    expect(m.message).toContain('/auditoria?p=');
    p = { ...p, ...applyAction(p, m.send!, T, S).updates };
    expect(columnOf(p)).toBe('auditoria');
  });

  it('sin respuesta y vencido: recordatorio; con todos los seguimientos: dar por perdido', () => {
    const due = P({ stage: 'contactado', lastContactAt: '2026-10-15', nextActionDate: '2026-10-17', followUps: 1 });
    expect(nextMove(due, T, S)).toMatchObject({ send: 'follow_up', canReply: true });
    expect(turnTone(due, nextMove(due, T, S), S)).toBe('suyo');
    const cold = { ...due, followUps: 3 };
    expect(nextMove(cold, T, S).choose?.[0].action).toBe('lost');
    expect(turnTone(cold, nextMove(cold, T, S), S)).toBe('frio');
  });

  it('auditoría completa sin video: pide el link del video', () => {
    expect(nextMove(P({ stage: 'auditoria_completada', audit: { total: 15 } }), T, S).need).toBe('video');
  });

  it('llamada sin hora: pedir horario; pasada: cómo salió', () => {
    expect(nextMove(P({ stage: 'llamada', callDate: T }), T, S).need).toBe('call_time');
    expect(nextMove(P({ stage: 'llamada', callDate: '2026-10-18', callTime: '10:00' }), T, S).need).toBe('call_outcome');
  });

  it('te escribió después del link: contestale', () => {
    const p = P({ stage: 'auditoria_enviada', awaitingMe: true, lastReplyAt: T, lastReplyNote: '¿cuánto sale?' });
    expect(nextMove(p, T, S)).toMatchObject({ title: 'Contestale', send: 'i_replied' });
  });
});

describe('mover a mano', () => {
  it('a Conversando queda para que le contestes; a Perdido, descartado', () => {
    expect(moveUpdates(P({ stage: 'contactado' }), 'conversando', T, S)).toMatchObject({ stage: 'respondio', convStep: 'pregunta', awaitingMe: true });
    expect(moveUpdates(P({ stage: 'contactado' }), 'perdido', T, S)).toMatchObject({ stage: 'descartado' });
  });
});
