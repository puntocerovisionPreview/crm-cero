import { describe, expect, it } from 'vitest';
import { limpiarRespuestas, partesDe, semaforoAlta, type ItemCopiado } from '../src/portal/arranque';
import { arranqueDelPortal } from '../src/portal/model';
import { CARTA_MATERIALES, habilitarMateriales } from '../src/portal/tareasArranque';

const completas = { estudio: ' Adrede ', contacto: 'David, socio', whatsapp: '+54 9 11 2345 6789', emailCarpeta: 'David@Gmail.com' };

describe('formulario del alta nueva', () => {
  it('limpia lo que manda el portal y pide lo obligatorio', () => {
    const r = limpiarRespuestas({ ...completas, materiales: ['Renders', 'Inventado', 'Renders'], hackeo: 'x' });
    expect(r.errores).toEqual([]);
    expect(r.respuestas.estudio).toBe('Adrede');
    expect(r.respuestas.emailCarpeta).toBe('david@gmail.com');
    expect(r.respuestas.materiales).toEqual(['Renders']);
    expect('hackeo' in r.respuestas).toBe(false);
    expect(limpiarRespuestas({ estudio: 'A' }).errores.length).toBe(3);
    expect(limpiarRespuestas({ ...completas, emailCarpeta: 'sin-arroba' }).errores).toContain('El correo no es válido.');
  });
});

describe('carpetas copiadas del modelo', () => {
  const f = (ruta: string[], carpeta = true): ItemCopiado => ({ ruta, carpeta, url: `https://drive.google.com/x/${ruta.join('/')}` });
  it('reconoce cada parte por su nombre, como el script', () => {
    const p = partesDe(
      { url: 'https://drive.google.com/c', items: [
        f(['00_BIENVENIDA.pdf'], false), f(['01_Para_completar']), f(['01_Para_completar', 'Excel_Cliente_ideal_nicho_y_oferta.xlsx'], false),
        f(['02_Materiales']), f(['02_Materiales', '01_Proyectos']), f(['02_Materiales', '02_Equipo_y_marca']), f(['02_Materiales', '03_Referencias']), f(['02_Materiales', '04_Registro_de_obra']),
        f(['03_Resultados']),
      ] },
      { url: 'https://drive.google.com/i', items: [f(['00_Ficha_actual.md'], false), f(['01_Acuerdo_y_arranque'])] },
    );
    expect(p.carpetaCompartida).toBe('https://drive.google.com/c');
    expect(p.paraCompletar).toContain('01_Para_completar');
    expect(p.materiales).toContain('02_Materiales');
    expect(p.proyectos).toContain('01_Proyectos');
    expect(p.equipo).toContain('Equipo');
    expect(p.referencias).toContain('Referencias');
    expect(p.registro).toContain('Registro');
    expect(p.resultados).toContain('Resultados');
    expect(p.excelClienteIdeal).toContain('Cliente_ideal');
    expect(p.carpetaInterna).toBe('https://drive.google.com/i');
    expect(p.ficha).toContain('Ficha');
  });
});

describe('qué ve el portal y la ficha', () => {
  it('el portal pide los datos, después avisa que crea las carpetas y al final no muestra nada', () => {
    expect(arranqueDelPortal({})).toBeNull();
    expect(arranqueDelPortal({ pafAltaNueva: true })).toEqual({ pendiente: true });
    expect(arranqueDelPortal({ pafAltaNueva: true, pafArranque: { enviadoEn: 'x', estado: 'creando' } })).toEqual({ pendiente: false, creando: true });
    expect(arranqueDelPortal({ pafAltaNueva: true, pafArranque: { enviadoEn: 'x', estado: 'listo' } })).toBeNull();
  });
  it('el semáforo dice en qué paso está y muestra el error', () => {
    const base = { pafClienteId: 'PAF-012', pafPortal: { publishedAt: '2026-11-12' } };
    expect(semaforoAlta(base).map((p) => p.estado)).toEqual(['hecho', 'hecho', 'esperando', 'pendiente', 'pendiente']);
    const error = semaforoAlta({ ...base, pafArranque: { respuestas: {}, email: 'a@b.c', enviadoEn: '2026-11-12T10:00:00Z', estado: 'error', error: 'Drive no deja leer', actualizadoEn: '' } });
    expect(error[3]).toMatchObject({ estado: 'error', detalle: 'Drive no deja leer' });
  });
});

describe('tareas de materiales', () => {
  let n = 0;
  const id = () => `t${++n}`;
  it('agrega las 4 en la carta "Tus materiales", la primera va primero, y no duplica', () => {
    const t = habilitarMateriales([], '2026-11-12T10:00:00Z', id)!;
    expect(t).toHaveLength(4);
    expect(t.every((x) => x.carta === CARTA_MATERIALES && x.estado === 'habilitada' && x.pideArchivos)).toBe(true);
    expect(t.map((x) => x.carpeta)).toEqual(['proyectos', 'equipo', 'referencias', 'registro']);
    expect(t[0].prioritaria).toBe(true);
    expect(t[0].fecha).toBe('2026-11-19');
    expect(habilitarMateriales(t, '2026-11-12T10:00:00Z', id)).toBeNull();
  });
});
