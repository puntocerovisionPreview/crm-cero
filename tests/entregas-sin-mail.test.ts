import { describe, expect, it } from 'vitest';
import { avisoEntrega } from '../src/portal/mensajes';
import { BASE_DEL_TEMA, PAF_DELIVERY_STATE_LABEL, entregaHecha } from '../src/portal/model';
import { PRESENCIA_TEMAS } from '../src/portal/presencia';

describe('Entregas sin aprobación por mail', () => {
  it('existe el estado Entregado y cuenta como hecho (igual que las aprobadas viejas)', () => {
    expect(PAF_DELIVERY_STATE_LABEL.entregada).toBe('Entregado');
    expect(entregaHecha('entregada')).toBe(true);
    expect(entregaHecha('aprobada')).toBe(true);
    expect(entregaHecha('ajustes')).toBe(false);
    expect(entregaHecha(undefined)).toBe(false);
  });

  it('el aviso de WhatsApp dice dónde quedó y no pide aprobar por mail', () => {
    const m = avisoEntrega({ nombre: 'Ana', entrega: { titulo: 'Kit de cliente ideal', version: 'v1', decision: 'si este foco te representa' }, resultados: 'https://drive.google.com/r' });
    expect(m).toContain('Hola Ana!');
    expect(m).toContain('Kit de cliente ideal (v1)');
    expect(m).toContain('Resultados: https://drive.google.com/r');
    expect(m).toContain('si este foco te representa');
    expect(m).not.toMatch(/mail/i);
  });

  it('el link de la entrega va antes que el de la carpeta', () => {
    expect(avisoEntrega({ nombre: 'Ana', entrega: { titulo: 'Kit', enlace: 'https://drive.google.com/kit' }, resultados: 'https://drive.google.com/r' })).toContain('https://drive.google.com/kit');
  });

  it('ninguna plantilla de Presencia pide confirmar por mail', () => {
    expect(PRESENCIA_TEMAS.flatMap(t => t.entregas).some(e => e.canal === 'mail')).toBe(false);
  });

  it('la Base: Kit = página 1, Diagnóstico = 2, Mensaje = 3, canales = 4', () => {
    expect(BASE_DEL_TEMA.cliente_ideal?.pagina).toBe(1);
    expect(BASE_DEL_TEMA.diagnostico?.pagina).toBe(2);
    expect(BASE_DEL_TEMA.mensaje?.pagina).toBe(3);
    expect([BASE_DEL_TEMA.instagram?.pagina, BASE_DEL_TEMA.google?.pagina, BASE_DEL_TEMA.web?.pagina]).toEqual([4, 4, 4]);
  });
});
