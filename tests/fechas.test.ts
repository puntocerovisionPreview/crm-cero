import { describe, expect, it } from 'vitest';
import { fechaCorta, proximoVencimiento, textoVence } from '../src/utils/fechas';

describe('fechas', () => {
  it('fecha corta, con año solo si no es el actual', () => {
    expect(fechaCorta('2026-06-10', '2026-11-10')).toBe('10 jun');
    expect(fechaCorta('2025-06-10', '2026-11-10')).toBe('10 jun 2025');
    expect(fechaCorta('', '2026-11-10')).toBe('Sin fecha');
  });

  it('texto de vencimiento', () => {
    expect(textoVence('2026-11-10', '2026-11-10')).toBe('Vence hoy');
    expect(textoVence('2026-11-04', '2026-11-10')).toBe('Venció el 4 nov');
    expect(textoVence('2026-12-04', '2026-11-10')).toBe('Vence el 4 dic');
    expect(textoVence(undefined, '2026-11-10')).toBe('Sin fecha');
  });

  it('si ya se pagó el mes del vencimiento, el próximo es el del ciclo siguiente', () => {
    expect(proximoVencimiento('2026-11-04', '2026-11-06', 'mensual')).toBe('2026-12-04');
    expect(proximoVencimiento('2026-12-20', '2026-12-01', 'mensual')).toBe('2027-01-20');
    expect(proximoVencimiento('2026-11-04', '2026-11-06', 'anual')).toBe('2027-11-04');
    expect(proximoVencimiento('2026-01-31', '2026-01-31', 'mensual')).toBe('2026-02-28');
  });

  it('si no se pagó ese mes, el vencimiento queda como está', () => {
    expect(proximoVencimiento('2026-11-04', '2026-10-06', 'mensual')).toBe('2026-11-04');
    expect(proximoVencimiento('2026-11-04', undefined, 'mensual')).toBe('2026-11-04');
  });
});
