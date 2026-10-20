import { describe, expect, it } from 'vitest';
import { ContentPiece } from '../src/content/model';
import { contentEveningNotice, contentMorningNotice, readinessNote } from '../src/content/reminders';

const piece = (over: Partial<ContentPiece>): ContentPiece => ({
  id: over.id || 'x',
  date: '2026-10-21',
  support: 'carrusel',
  idea: '',
  status: 'listo para publicar',
  title: 'Pieza',
  slides: [],
  resources: [],
  ...over,
});

const pieces = [
  piece({ id: 'hoy', date: '2026-10-21', title: 'Bingo del estudio', slides: [{ full: 'a', display: 'a', thumb: 'a' }, { full: 'b', display: 'b', thumb: 'b' }], caption: 'Texto', resources: [{ word: 'BINGO', name: 'PDF', url: '' }] }),
  piece({ id: 'manana', date: '2026-10-22', support: 'reel', title: 'Defiendo el boca en boca', status: 'guion aprobado' }),
  piece({ id: 'pasada', date: '2026-10-19', title: 'El ciclo', status: 'carrusel renderizado (para revisar)' }),
  piece({ id: 'vieja', date: '2026-10-01', title: 'Muy vieja', status: 'idea' }),
  piece({ id: 'publicada', date: '2026-10-21', title: 'Ya salió', status: 'publicado' }),
];

describe('avisos de contenido', () => {
  it('a la mañana: lo de hoy, con slides, palabra clave y caption', () => {
    const n = contentMorningNotice(pieces, '2026-10-21')!;
    expect(n.title).toBe('📣 Hoy se publica: Bingo del estudio');
    expect(n.body).toContain('Carrusel: Bingo del estudio (2 slides)');
    expect(n.body).toContain('palabra clave BINGO');
    expect(n.body).toContain('caption');
    expect(n.body).not.toContain('Ya salió');
  });

  it('a la mañana también recuerda lo de la última semana sin marcar publicada', () => {
    const n = contentMorningNotice(pieces, '2026-10-21')!;
    expect(n.body).toContain('Sin marcar publicada: El ciclo');
    expect(n.body).not.toContain('Muy vieja');
  });

  it('a la tarde: lo de mañana y qué dejar listo hoy', () => {
    const n = contentEveningNotice(pieces, '2026-10-21')!;
    expect(n.title).toBe('🗓️ Mañana toca: Defiendo el boca en boca');
    expect(n.body).toContain('Dejalo listo hoy: Defiendo el boca en boca (falta grabar y editar)');
  });

  it('si no hay nada, no avisa', () => {
    expect(contentEveningNotice(pieces, '2026-10-25')).toBeNull();
    expect(contentMorningNotice([], '2026-10-21')).toBeNull();
  });

  it('dice qué falta según el estado y el formato', () => {
    expect(readinessNote(piece({ status: 'carrusel renderizado (para revisar)' }))).toBe('falta revisar las slides');
    expect(readinessNote(piece({ support: 'reel', status: 'grabado' }))).toBe('grabado, falta editar');
    expect(readinessNote(piece({ status: 'listo para publicar' }))).toBe('lista para publicar');
  });
});
