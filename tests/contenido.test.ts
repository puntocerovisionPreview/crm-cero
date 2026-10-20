import { describe, expect, it } from 'vitest';
import { groupByWeek, isLate, mergeImported, nextToPublish, planImport, resolveZipPath, statusStage, supportOf } from '../src/content/model';
import { assetDocId } from '../src/content/assets';

const calendar = {
  titulo: 'Calendario · del lun 19/10 al dom 22/11/2026',
  piezas: [
    { 'n°': '1', fecha: '19/10', soporte: 'reel', 'idea en una línea': 'El ciclo de la obra', estado: 'publicado', iso: '2026-10-19', slides: [], recursos: [], guion: null, CTA: '—' },
    {
      'n°': '5',
      fecha: '26/10',
      soporte: 'carrusel',
      'idea en una línea': 'Cartón de 16 situaciones',
      CTA: 'comentá BINGO',
      estado: 'carrusel renderizado (para revisar)',
      iso: '2026-10-26',
      titulo: 'Bingo del estudio',
      caption: 'Lo armé con cosas…',
      slug: '2026-10-26-bingo-del-estudio',
      slides: [
        { alta: 'c/2026-10-26-bingo-del-estudio/01.png', mini: 'm/2026-10-26-bingo-del-estudio/01.jpg', px: '2160×2700' },
        { alta: 'c/2026-10-26-bingo-del-estudio/02.png', mini: 'm/2026-10-26-bingo-del-estudio/02.jpg' },
        { alta: 'c/falta/03.png', mini: 'm/falta/03.jpg' },
      ],
      recursos: [
        { palabra: 'BINGO', nombre: 'Cartón para imprimir', pub: 'r/bingo-del-estudio.pdf' },
        { palabra: 'QUIZ', nombre: 'Quiz en la web', archivo: null },
      ],
    },
    {
      'n°': '6',
      fecha: '28/10',
      soporte: 'Reel',
      'idea en una línea': 'Defiendo el boca en boca',
      estado: 'guion aprobado',
      guion: { titulo: 'Defiendo el boca en boca', formato: 'reel a cámara', que: 'El giro', html: '<h4>Antes</h4><ul><li>Luz</li></ul>', texto: 'GUION\n…', caption: 'Caption del guion' },
      slides: [],
      recursos: [],
    },
  ],
};

const zip = new Set([
  'calendario/c/2026-10-26-bingo-del-estudio/01.png',
  'calendario/c/2026-10-26-bingo-del-estudio/02.png',
  'calendario/m/2026-10-26-bingo-del-estudio/01.jpg',
  'calendario/m/2026-10-26-bingo-del-estudio/02.jpg',
  'calendario/r/bingo-del-estudio.pdf',
]);

describe('contenido: importar el calendario', () => {
  const plan = planImport(calendar, zip, (p) => `https://x/${p}`);

  it('lee todas las piezas con fecha, aunque falte "iso"', () => {
    expect(plan.pieces.map((p) => p.date)).toEqual(['2026-10-19', '2026-10-26', '2026-10-28']);
    expect(plan.title).toContain('Calendario');
  });

  it('normaliza el soporte y limpia el CTA vacío', () => {
    expect(plan.pieces.map((p) => p.support)).toEqual(['reel', 'carrusel', 'reel']);
    expect(plan.pieces[0].cta).toBeUndefined();
  });

  it('arma las slides con alta, 1080 y miniatura; lo que no está en el zip se saltea', () => {
    const bingo = plan.pieces[1];
    expect(bingo.id).toBe('2026-10-26-bingo-del-estudio');
    expect(bingo.slides).toHaveLength(2);
    expect(bingo.slides[0]).toEqual({
      full: 'https://x/contenido/2026-10-26-bingo-del-estudio/01-1080.jpg',
      display: 'https://x/contenido/2026-10-26-bingo-del-estudio/01-1080.jpg',
      thumb: 'https://x/contenido/2026-10-26-bingo-del-estudio/01-mini.jpg',
      px: '2160×2700',
    });
    const kinds = plan.assets.map((a) => a.kind);
    expect(kinds.filter((k) => k === 'full')).toHaveLength(0);
    expect(kinds.filter((k) => k === 'display')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'pdf')).toHaveLength(1);
    plan.assets.forEach((a) => expect(assetDocId(a.storagePath)).toMatch(/^[a-z0-9._-]+$/));
  });

  it('los recursos por palabra clave quedan con su PDF', () => {
    expect(plan.pieces[1].resources).toEqual([
      { word: 'BINGO', name: 'Cartón para imprimir', url: 'https://x/contenido/recursos/bingo-del-estudio.pdf' },
      { word: 'QUIZ', name: 'Quiz en la web', url: '' },
    ]);
  });

  it('el guion trae el caption si la pieza no tiene', () => {
    const reel = plan.pieces[2];
    expect(reel.script?.title).toBe('Defiendo el boca en boca');
    expect(reel.caption).toBe('Caption del guion');
    expect(reel.id).toMatch(/^2026-10-28-/);
  });

  it('sin .zip se importan los textos igual', () => {
    const only = planImport(calendar, new Set());
    expect(only.pieces).toHaveLength(3);
    expect(only.assets).toHaveLength(0);
    expect(only.pieces[1].slides).toHaveLength(0);
  });

  it('encuentra archivos aunque el zip tenga una carpeta raíz', () => {
    expect(resolveZipPath('r/bingo-del-estudio.pdf', zip)).toBe('calendario/r/bingo-del-estudio.pdf');
    expect(resolveZipPath('r/otro.pdf', zip)).toBeNull();
  });
});

describe('contenido: reimportar no borra nada', () => {
  const [, bingo] = planImport(calendar, zip, (p) => p).pieces;

  it('respeta el estado que cambiaste en la app', () => {
    const merged = mergeImported(bingo, { ...bingo, status: 'publicado', statusChangedAt: '2026-10-26T20:00:00Z' });
    expect(merged.status).toBe('publicado');
  });

  it('si el archivo trae otro estado y vos no lo tocaste, se actualiza', () => {
    expect(mergeImported(bingo, { ...bingo, status: 'idea' }).status).toBe(bingo.status);
  });

  it('importar solo el .json conserva las slides ya subidas', () => {
    const textOnly = { ...bingo, slides: [], resources: [] };
    const merged = mergeImported(textOnly, bingo);
    expect(merged.slides).toHaveLength(2);
    expect(merged.resources).toHaveLength(2);
  });
});

describe('contenido: semanas y estados', () => {
  const { pieces } = planImport(calendar, new Set());

  it('agrupa de lunes a domingo', () => {
    const weeks = groupByWeek(pieces);
    expect(weeks.map((w) => w.start)).toEqual(['2026-10-19', '2026-10-26']);
    expect(weeks[1].end).toBe('2026-11-01');
    expect(weeks[1].pieces).toHaveLength(2);
  });

  it('la próxima es la primera no publicada desde hoy', () => {
    expect(nextToPublish(pieces, '2026-10-20')?.date).toBe('2026-10-26');
    expect(nextToPublish(pieces, '2026-10-29')).toBeNull();
  });

  it('atrasada: pasó el día y no se publicó', () => {
    expect(isLate(pieces[0], '2026-10-25')).toBe(false); // ya publicada
    expect(isLate(pieces[1], '2026-10-27')).toBe(true);
  });

  it('agrupa los estados en etapas', () => {
    expect(statusStage('carrusel renderizado (para revisar)')).toBe('revisar');
    expect(statusStage('guion listo (PDF)')).toBe('guion');
    expect(statusStage('slides listas (PDF, diseño manual)')).toBe('produccion');
    expect(statusStage('listo para publicar')).toBe('listo');
    expect(statusStage('publicado')).toBe('publicado');
    expect(supportOf('Estático')).toBe('estatico');
  });
});

describe('contenido: archivos en Firestore', () => {
  it('cada ruta da un id de documento válido y estable', () => {
    expect(assetDocId('contenido/2026-10-26-bingo/01-1080.jpg')).toBe('contenido__2026-10-26-bingo__01-1080.jpg');
    expect(assetDocId('contenido/recursos/bingo.pdf')).toBe('contenido__recursos__bingo.pdf');
  });
});
