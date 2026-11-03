import { describe, expect, it } from 'vitest';
import { inviteKey, meetingToEvent } from '../server/calendarSync';
import { clientInviteEmails } from '../src/components/PafReunionCard';

describe('invitar al cliente a la reunión', () => {
  it('invita a los correos de su portal; si no hay, al de la ficha', () => {
    expect(clientInviteEmails({ pafPortal: { emails: ['Ana@Estudio.com', 'ana@estudio.com', 'socia@x.com'] } as any, clientEmail: 'otro@x.com' })).toEqual(['ana@estudio.com', 'socia@x.com']);
    expect(clientInviteEmails({ clientEmail: ' Cliente@Gmail.com ' })).toEqual(['cliente@gmail.com']);
    expect(clientInviteEmails({ clientEmail: 'no es un correo' })).toEqual([]);
  });

  it('la huella de invitados ignora orden, mayúsculas, repetidos y correos rotos', () => {
    expect(inviteKey({ invitados: ['b@x.com', 'A@x.com', 'a@x.com', 'roto'] })).toBe('a@x.com,b@x.com');
    expect(inviteKey({})).toBe('');
  });

  it('el evento base no lleva invitados (los agrega solo tu cuenta)', () => {
    const ev = meetingToEvent({ id: 'm1', title: 'Seguimiento', date: '2026-11-10', time: '10:30', invitados: ['a@x.com'] } as any);
    expect(ev.attendees).toBeUndefined();
    expect(ev.extendedProperties.private.ceroMeetingId).toBe('m1');
  });
});

import { buildGoogleCalendarEventPayload } from '../src/utils/googleCalendarBrowser';

describe('Calendar desde el navegador', () => {
  it('marca el evento con la reunión del CRM (así el servidor no lo duplica)', () => {
    const ev = buildGoogleCalendarEventPayload({ id: 'm1', title: 'Seguimiento', date: '2026-11-10', time: '10:30', invitados: ['A@x.com'] } as any);
    expect(ev.extendedProperties).toEqual({ private: { ceroMeetingId: 'm1' } });
    expect(ev.attendees).toEqual([{ email: 'a@x.com' }]);
  });
});
