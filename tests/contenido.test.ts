import { describe, expect, it } from 'vitest';
import { findCalendarJson, groupByWeek, isLate, mergeImported, monthGrid, nextToPublish, planImport, resolveZipPath, shiftMonth, slidesInFolder, statusStage, supportOf } from '../src/content/model';
import { CLAUDE_INSTRUCTIONS, EXAMPLE_CALENDAR } from '../src/content/template';
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

  it('un recurso sin PDF en este .zip conserva el que ya estaba', () => {
    const sinPdf = { ...bingo, slides: [], resources: [{ word: 'BINGO', name: 'Cartón', url: '' }] };
    expect(mergeImported(sinPdf, bingo).resources.find((r) => r.word === 'BINGO')?.url).toBe(bingo.resources[0].url);
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

describe('contenido: plantilla simple (carpeta por pieza, todo en un .zip)', () => {
  const simple = {
    titulo: 'Noviembre 2026',
    piezas: [
      { iso: '2026-11-03', slug: '2026-11-03-bingo', soporte: 'carrusel', titulo: 'Bingo', estado: 'idea' },
      { iso: '2026-11-05', slug: '2026-11-05-lista', soporte: 'carrusel', titulo: 'Lista', slides: ['c/2026-11-05-lista/02.png', 'c/2026-11-05-lista/01.png'] },
    ],
  };
  const files = new Set([
    'calendario.json',
    'c/2026-11-03-bingo/10.png',
    'c/2026-11-03-bingo/02.png',
    'c/2026-11-03-bingo/01.png',
    'm/2026-11-03-bingo/01.jpg',
    'c/2026-11-05-lista/01.png',
    'c/2026-11-05-lista/02.png',
  ]);

  it('sin "slides", toma las imágenes de c/<slug>/ en orden numérico', () => {
    expect(slidesInFolder('2026-11-03-bingo', files).map((s) => s.full)).toEqual([
      'c/2026-11-03-bingo/01.png',
      'c/2026-11-03-bingo/02.png',
      'c/2026-11-03-bingo/10.png',
    ]);
    const plan = planImport(simple, files);
    expect(plan.pieces[0].slides).toHaveLength(3);
  });

  it('usa la miniatura de m/ si está, y si no la genera de la slide', () => {
    const plan = planImport(simple, files);
    const thumbs = plan.assets.filter((a) => a.kind === 'thumb' && a.storagePath.includes('bingo'));
    expect(thumbs.map((t) => t.zipPath)).toEqual(['m/2026-11-03-bingo/01.jpg', 'c/2026-11-03-bingo/02.png', 'c/2026-11-03-bingo/10.png']);
  });

  it('respeta el orden si la pieza lista las slides como texto', () => {
    const plan = planImport(simple, files, (p) => p);
    expect(plan.pieces[1].slides).toHaveLength(2);
    expect(plan.assets.find((a) => a.storagePath === 'contenido/2026-11-05-lista/01-1080.jpg')?.zipPath).toBe('c/2026-11-05-lista/02.png');
  });

  it('encuentra el calendario dentro del zip', () => {
    expect(findCalendarJson(['c/x/01.png', 'otra/cosa.json', 'calendario.json'])).toBe('calendario.json');
    expect(findCalendarJson(['carpeta/datos.json'])).toBe('carpeta/datos.json');
    expect(findCalendarJson(['c/x/01.png'])).toBeNull();
  });

  it('la plantilla para Claude se importa tal cual', () => {
    const plan = planImport(EXAMPLE_CALENDAR, new Set());
    expect(plan.pieces.map((p) => p.support)).toEqual(['carrusel', 'reel']);
    expect(plan.pieces[1].script?.text).toContain('GUION');
    expect(CLAUDE_INSTRUCTIONS).toContain('c/<slug>/01.png');
  });
});

describe('contenido: calendario mensual', () => {
  it('arma semanas completas de lunes a domingo', () => {
    const g = monthGrid('2026-11'); // 1/11/2026 es domingo
    expect(g[0]).toBe('2026-10-26');
    expect(g[g.length - 1]).toBe('2026-12-06');
    expect(g.length % 7).toBe(0);
  });

  it('pasa de mes y de año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});
