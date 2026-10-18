import { describe, expect, it } from 'vitest';
import { sectorForPath } from '../src/utils/sectors';
import { parseRoute } from '../src/utils/router';

describe('Home por sectores', () => {
  it('cada pantalla pertenece a su sector', () => {
    const casos: Record<string, string | null> = {
      '/hoy': 'dia',
      '/agenda/tarea/abc': 'dia',
      '/semana': 'dia',
      '/calendario': 'dia',
      '/foco': 'dia',
      '/prospeccion': 'prospeccion',
      '/clientes': 'clientes',
      '/clientes/p1': 'clientes',
      '/horizonte': 'clientes',
      '/dinero': 'finanzas',
      '/gastos-fijos': 'finanzas',
      '/mis-finanzas/cuentas': 'finanzas',
      '/cerebro': 'cerebro',
      '/inicio': null,
      '/ajustes': null,
    };
    Object.entries(casos).forEach(([path, sector]) => {
      expect(sectorForPath(path)?.key ?? null, path).toBe(sector);
    });
  });

  it('abrir la app lleva a Inicio', () => {
    expect(parseRoute('/', '').name).toBe('inicio');
    expect(parseRoute('/inicio', '').path).toBe('/inicio');
    expect(parseRoute('/hoy', '').name).toBe('hoy');
  });
});
