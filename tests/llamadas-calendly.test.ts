import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { applyAction, bookingLinkFor, callMeetingFor, renderTemplate, DEFAULT_PROSPECTING_SETTINGS } from '../src/prospecting/core';
import { matchCalendlyInvitee, verifyCalendlySignature } from '../server/calendly';

const P = (over: any) => ({ id: over.id || 'p1', name: 'Laura Pérez', stage: 'respondio', createdAt: '2026-10-12', followUps: 0, ...over }) as any;

describe('agendar la llamada', () => {
  it('guarda día y hora', () => {
    const { updates, event } = applyAction(P({}), 'call', '2026-10-17', undefined, '2026-10-21 15:30');
    expect(updates).toMatchObject({ stage: 'llamada', callDate: '2026-10-21', callTime: '15:30' });
    expect(event?.type).toBe('call');
  });

  it('reprogramar no suma otra llamada a las métricas', () => {
    const { updates, event } = applyAction(P({ stage: 'llamada', callDate: '2026-10-21' }), 'call', '2026-10-21', undefined, '2026-10-23 10:00');
    expect(updates.callDate).toBe('2026-10-23');
    expect(event).toBeNull();
  });

  it('la reunión de la agenda tiene hora, duración y datos del prospecto', () => {
    const m = callMeetingFor(P({ studio: 'Estudio LP', whatsapp: '+5493515551234' }), '2026-10-21', '15:30', 30, '2026-10-17');
    expect(m).toMatchObject({ id: 'call_p1', title: 'Llamada: Estudio LP', date: '2026-10-21', time: '15:30', durationHours: 0.5, reminderMinutesBefore: 15, clientPhone: '+5493515551234' });
  });

  it('el link de Calendly lleva el código del prospecto', () => {
    expect(bookingLinkFor(P({}), 'https://calendly.com/juan/20min')).toBe('https://calendly.com/juan/20min?utm_source=cero&utm_content=p1');
    expect(bookingLinkFor(P({}), 'https://cal.com/juan')).toBe('https://cal.com/juan');
    const s = { ...DEFAULT_PROSPECTING_SETTINGS, bookingUrl: 'https://calendly.com/juan' };
    expect(renderTemplate('{agenda}', P({}), s)).toContain('utm_content=p1');
  });
});

describe('Calendly', () => {
  const key = 'clave-de-prueba';
  const body = '{"event":"invitee.created"}';
  const sign = (t: number, b = body) => `t=${t},v1=${crypto.createHmac('sha256', key).update(`${t}.${b}`).digest('hex')}`;

  it('acepta solo avisos firmados y recientes', () => {
    const now = 1_800_000_000;
    expect(verifyCalendlySignature(sign(now), body, key, now)).toBe(true);
    expect(verifyCalendlySignature(sign(now), body + ' ', key, now)).toBe(false);
    expect(verifyCalendlySignature(sign(now - 3600), body, key, now)).toBe(false);
    expect(verifyCalendlySignature('', body, key, now)).toBe(false);
  });

  it('reconoce quién reservó: código, email, teléfono o nombre', () => {
    const list = [
      P({ id: 'a', email: 'laura@lp.com' }),
      P({ id: 'b', whatsapp: '+54 9 351 555-1234', name: 'Otro' }),
      P({ id: 'c', studio: 'Estudio Norte', name: 'Pedro' }),
    ];
    expect(matchCalendlyInvitee({ tracking: { utm_content: 'c' }, email: 'laura@lp.com' }, list)?.id).toBe('c');
    expect(matchCalendlyInvitee({ email: 'LAURA@lp.com ' }, list)?.id).toBe('a');
    expect(matchCalendlyInvitee({ text_reminder_number: '+5493515551234' }, list)?.id).toBe('b');
    expect(matchCalendlyInvitee({ name: 'Estudio Norte' }, list)?.id).toBe('c');
    expect(matchCalendlyInvitee({ name: 'Nadie' }, list)).toBeUndefined();
  });
});
