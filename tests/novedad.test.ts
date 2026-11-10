import { describe, expect, it } from 'vitest';
import { aplicarNovedad, haceCuanto, leerNovedad, ultimaNovedad } from '../src/portal/novedad';
import { esImagen, esVideo, ultimoDelPortal } from '../src/portal/ultimo';

let n = 0;
const newId = () => `id${++n}`;
const base = { clientName: 'Estudio X' };

describe('caja de novedad', () => {
  it('separa el link del texto y adivina el tipo', () => {
    expect(leerNovedad('Esta semana dejamos lista la home')).toEqual({ texto: 'Esta semana dejamos lista la home', link: null, tipo: 'novedad' });
    const e = leerNovedad('Te dejo el borrador de la home https://drive.google.com/abc.');
    expect(e).toEqual({ texto: 'Te dejo el borrador de la home', link: 'https://drive.google.com/abc', tipo: 'entrega' });
    expect(leerNovedad('Necesito que subas 10 fotos del estudio').tipo).toBe('pedido');
    expect(leerNovedad('Subí las fotos acá https://drive.google.com/x').tipo).toBe('pedido');
    expect(leerNovedad('Mirá este video www.loom.com/share/1').link).toBe('https://www.loom.com/share/1');
    // "subimos" no es un pedido
    expect(leerNovedad('Subimos el reel de la obra').tipo).toBe('novedad');
  });

  it('publica una novedad como anuncio visible, con historial', () => {
    const r = aplicarNovedad(base, 'Arrancamos con el diseño', { newId, now: '2026-11-10T12:00:00.000Z', fijar: true });
    if ('error' in r) throw new Error(r.error);
    expect(r.tipo).toBe('novedad');
    expect(r.updates.pafAnuncios).toHaveLength(1);
    expect(r.updates.pafAnuncios![0]).toMatchObject({ texto: 'Arrancamos con el diseño', publicado: true, fijado: true, creadoEn: '2026-11-10T12:00:00.000Z' });
    expect(r.updates.pafHistorial!.some((h) => h.texto.includes('Novedad publicada'))).toBe(true);
  });

  it('una entrega va a Entregas publicada y con fecha; un pedido, a tareas habilitadas', () => {
    const e = aplicarNovedad(base, 'Borrador de la home https://figma.com/f/1', { newId, now: '2026-11-10T12:00:00.000Z' });
    if ('error' in e) throw new Error(e.error);
    expect(e.updates.pafEntregas![0]).toMatchObject({ titulo: 'Borrador de la home', enlace: 'https://figma.com/f/1', publicada: true, fecha: '2026-11-10' });
    const p = aplicarNovedad(base, 'Elegí 3 fotos\nLas que más te gusten', { newId, now: '2026-11-10T12:00:00.000Z' });
    if ('error' in p) throw new Error(p.error);
    expect(p.updates.pafTareas![0]).toMatchObject({ titulo: 'Elegí 3 fotos', detalle: 'Las que más te gusten', estado: 'habilitada', habilitadaEn: '2026-11-10T12:00:00.000Z' });
  });

  it('no publica vacío ni un link suelto', () => {
    expect(aplicarNovedad(base, '   ', { newId })).toEqual({ error: 'Escribí la novedad.' });
    expect('error' in aplicarNovedad(base, 'https://drive.google.com/abc', { newId })).toBe(true);
  });

  it('última novedad y hace cuánto', () => {
    expect(ultimaNovedad({})).toBeNull();
    expect(ultimaNovedad({
      pafAnuncios: [{ id: 'a', texto: 'x', publicado: true, creadoEn: '2026-11-01T10:00:00Z' }, { id: 'b', texto: 'oculto', publicado: false, creadoEn: '2026-11-09T10:00:00Z' }],
      pafEntregas: [{ id: 'e', titulo: 'x', publicada: true, fecha: '2026-11-05' }],
    })).toBe('2026-11-05');
    expect(haceCuanto('2026-11-10', '2026-11-10')).toBe('hoy');
    expect(haceCuanto('2026-11-09', '2026-11-10')).toBe('ayer');
    expect(haceCuanto('2026-11-05', '2026-11-10')).toBe('hace 5 días');
    expect(haceCuanto('2026-10-20', '2026-11-10')).toBe('hace 3 semanas');
  });
});

describe('lo último del portal', () => {
  it('mezcla todo lo visible, fijado primero y después lo más nuevo', () => {
    const items = ultimoDelPortal({
      anuncios: [
        { id: '1', texto: 'Hola', fecha: '2026-11-01', fijado: true },
        { id: '2', texto: 'Te grabé esto', fecha: '2026-11-08', link: 'https://www.loom.com/share/x' },
        { id: '3', texto: 'Foto de la obra', fecha: '2026-11-03', link: 'https://x.com/foto.JPG' },
      ],
      entregas: [{ id: 'e1', titulo: 'Home', version: 'v2', fecha: '2026-11-09', publicada: true, enlace: 'https://figma.com/1' }, { id: 'e2', titulo: 'Sin fecha', publicada: true }],
      reuniones: [{ fecha: '2026-11-04', acuerdos: '- Definimos el tono\n- Otra', proximosPasos: '' }],
      tareas: [{ id: 't1', titulo: 'Fotos', estado: 'aprobada', aprobadaEl: '2026-11-06' }, { id: 't2', titulo: 'Otra', estado: 'habilitada' }],
      reportes: [],
    } as never);
    expect(items.map((i) => i.key)).toEqual(['a:1', 'e:e1', 'a:2', 't:t1', 'r:2026-11-04', 'a:3']);
    expect(items[1]).toMatchObject({ tipo: 'entrega', titulo: 'Home v2', link: 'https://figma.com/1' });
    expect(items[2].tipo).toBe('mensaje');
    expect(items[4].texto).toBe('Definimos el tono');
    expect(items[5].imagen).toBe('https://x.com/foto.JPG');
  });

  it('reconoce videos e imágenes por el link', () => {
    expect(esVideo('https://youtu.be/abc')).toBe(true);
    expect(esVideo('https://notloom.com/x')).toBe(false);
    expect(esVideo('nada')).toBe(false);
    expect(esImagen('https://x.com/a.png?x=1')).toBe(true);
    expect(esImagen('https://x.com/a.pdf')).toBe(false);
  });
});
