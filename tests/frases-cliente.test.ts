import { describe, expect, it } from 'vitest';
import { comoViene, resumenCliente, saludCliente } from '../src/portal/salud';
import { colorDe, iniciales } from '../src/utils/clientLook';

const today = '2026-11-07';
const base: any = { id: 'p', clientName: 'Estudio Bosque', serviceType: 'paf', archived: false };
const frase = (p: any, meetings: any[] = []) => resumenCliente(p, saludCliente(p, { meetings, today }), { meetings, today });

describe('cada cliente en una frase', () => {
  it('lo que te pide algo va primero', () => {
    expect(frase({ ...base, proximaAccion: { texto: 'x', responsable: 'yo', actualizada: '' }, pafTareas: [{ id: '1', titulo: 'Fotos', estado: 'enviada' }] })).toBe('Terminó «Fotos»: revisala.');
    expect(frase({ ...base, proximaAccion: { texto: 'Devolución del kit', responsable: 'yo', fecha: '2026-11-08', actualizada: '' } })).toBe('Te toca: Devolución del kit para el 08/11.');
    expect(frase({ ...base, proximaAccion: { texto: 'x', responsable: 'cliente', necesita: 'las 2 frases', actualizada: '' } })).toBe('Esperando que te mande: las 2 frases.');
  });
  it('suma el motivo de atención y si no hay nada, en orden', () => {
    const p = { ...base, proximaAccion: { texto: 'Kit', responsable: 'yo', actualizada: '' }, installments: [{ id: 'c', number: 1, dueDate: '2026-11-01', amount: 1, paid: false }] };
    expect(frase(p)).toBe('Te toca: Kit. Además, cuota atrasada desde el 01/11.');
    expect(frase({ ...base, proximaAccion: { texto: 'x', responsable: 'cliente', actualizada: '' } }).startsWith('Esperando')).toBe(true);
    expect(frase(base)).toBe('Le falta definir la próxima acción.');
  });
  it('cómo viene en la ficha', () => {
    const p = { ...base, proximaAccion: { texto: 'Kit', responsable: 'yo', actualizada: '' } };
    expect(comoViene(p, saludCliente(p, { meetings: [], today }), { meetings: [], today, semana: 2, etapa: 'Presencia', hitoTitulo: 'Definimos el foco' }))
      .toBe('Va por la semana 2, en Presencia: definimos el foco. Te toca: Kit.');
  });
  it('iniciales y color fijo', () => {
    expect(iniciales('Estudio Bosque')).toBe('B');
    expect(iniciales('Casa Norte Arquitectos')).toBe('CN');
    expect(colorDe({ clientName: 'X', pafPortal: { marca: '#112233' } } as any)).toBe('#112233');
    expect(colorDe({ clientName: 'Río' } as any)).toBe(colorDe({ clientName: 'Río' } as any));
  });
});
