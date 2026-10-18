import { describe, expect, it } from 'vitest';
import { coldClients, whatsappLink } from '../src/utils/coldClients';

const p = (id: string, over: any = {}) => ({ id, clientName: id, status: 'En curso', archived: false, createdAt: '2026-08-01', updatedAt: '', notes: '', ...over }) as any;
const hoy = '2026-10-18';

describe('Clientes que se enfrían', () => {
  it('aparece el cliente activo sin contacto hace 14 días o más', () => {
    const list = coldClients([p('a', { lastContactDate: '2026-10-01' }), p('b', { lastContactDate: '2026-10-10' })], [], [], hoy);
    expect(list.map(c => c.project.id)).toEqual(['a']);
    expect(list[0].daysSince).toBe(17);
  });

  it('una reunión hecha o un pago cuentan como contacto', () => {
    const meeting = { id: 'm', title: 'x', date: '2026-10-15', completed: true, projectId: 'a', createdAt: '' } as any;
    expect(coldClients([p('a', { lastContactDate: '2026-09-01' })], [meeting], [], hoy)).toHaveLength(0);
    expect(coldClients([p('b', { payments: [{ id: '1', amount: 1, date: '2026-10-12' }] })], [], [], hoy)).toHaveLength(0);
  });

  it('no muestra prospectos, archivados ni terminados', () => {
    const old = { lastContactDate: '2026-01-01' };
    expect(coldClients([p('l', { ...old, isLead: true }), p('r', { ...old, archived: true }), p('t', { ...old, status: 'completado' })], [], [], hoy)).toHaveLength(0);
  });

  it('marca si ya hay una tarea pendiente para escribirle', () => {
    const task = { id: 't', title: 'Escribirle a a', date: hoy, completed: false, projectId: 'a', createdAt: '' } as any;
    expect(coldClients([p('a', { lastContactDate: '2026-09-01' })], [], [task], hoy)[0].hasTask).toBe(true);
  });

  it('arma el link de WhatsApp con el 549 de Argentina', () => {
    expect(whatsappLink('351 15 555-1234')).toBe('https://wa.me/5493515551234');
    expect(whatsappLink('0351 15 555-1234')).toBe('https://wa.me/5493515551234');
    expect(whatsappLink('11 15 2345-6789')).toBe('https://wa.me/5491123456789');
    expect(whatsappLink('+54 9 351 5551234')).toBe('https://wa.me/5493515551234');
    expect(whatsappLink('')).toBeNull();
  });
});
