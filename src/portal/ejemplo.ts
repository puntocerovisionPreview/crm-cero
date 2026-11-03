/**
 * CLIENTE DE EJEMPLO: un estudio ficticio cargado como si estuviera en el hito 2 (Definimos el
 * foco), con todo lo que usa el método. Sirve para ver el panel y el portal completos.
 * Sus reuniones no van a Google Calendar y se borra entero con un botón desde su ficha.
 */
import type { AgendaMeeting, Project } from '../types';
import { PORTAL_SECCIONES, type PafPortalDraft } from './model';
import { temaPorId } from './presencia';
import { BIENVENIDA_PAF } from '../utils/newClient';

export const EJEMPLO_ID = 'PAF-EJEMPLO-001';
const DRIVE = 'https://drive.google.com/';

export function buildEjemplo(email: string, hoy = new Date()) {
  const d = (dias: number) => { const x = new Date(hoy); x.setDate(x.getDate() + dias); return x.toLocaleDateString('en-CA'); };
  const iso = (dias: number) => `${d(dias)}T12:00:00.000Z`;
  const t = (id: string) => `ej_${id}`;
  const arranque = temaPorId('arranque');
  const ideal = temaPorId('cliente_ideal');
  const diag = temaPorId('diagnostico');

  const draft: PafPortalDraft = {
    emails: [email.toLowerCase()],
    hito: 2,
    resumen: 'Esta semana revisamos tu Excel de cliente ideal y preparamos la devolución del foco. En paralelo relevamos tu competencia.',
    enlaces: {},
    accesos: [{ id: t('acc1'), nombre: 'Tu carpeta', url: DRIVE }],
    mostrarAvance: true,
    marca: '#2F6B4F',
    secciones: Object.fromEntries(PORTAL_SECCIONES.map((s) => [s.id, true])),
    gestionContenido: 'https://app.asana.com/',
    materiales: { proyectos: DRIVE, equipo: DRIVE, referencias: DRIVE, registro: DRIVE },
    reunionesAcordadas: 24,
  };

  const project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
    clientName: 'Estudio Bosque (ejemplo)',
    ownerName: 'Lucía',
    status: 'Kick-Off & Diagnóstico',
    notes: 'Cliente de ejemplo: datos inventados para ver el panel y el portal completos.',
    archived: false,
    clientEmail: email.toLowerCase(),
    serviceType: 'paf',
    projectType: 'paf_pro',
    pafStage: 'Kick-Off & Diagnóstico',
    startDate: d(-14),
    ejemplo: true,
    pafClienteId: EJEMPLO_ID,
    pafPortal: draft,
    pafAlcance: ['contenido', 'google'],
    pafTemas: {
      arranque: { empezado: d(-14), checks: arranque.completoCuando.map(() => true) },
      cliente_ideal: { empezado: d(-10), checks: [true, true, false, false] },
      diagnostico: { empezado: d(-7), checks: [true, false, false] },
    },
    pafHitos: [{ hito: 1, fecha: d(-8), evidencia: 'Objetivo y responsables confirmados en la reunión de arranque' }],
    pafTareas: [
      ...arranque.tareas.map((x, i) => ({ ...x, id: t(`a${i}`), tema: 'arranque' as const, estado: 'aprobada' as const, habilitadaEn: iso(-14), aprobacion: { fecha: iso(-11), canal: 'Portal' } })),
      { ...ideal.tareas[0], id: t('ci'), tema: 'cliente_ideal', estado: 'enviada', habilitadaEn: iso(-9), avisoEn: iso(-1) },
      { ...diag.tareas[0], id: t('dg'), tema: 'diagnostico', estado: 'habilitada', habilitadaEn: iso(-3), fecha: d(4), prioritaria: true },
    ],
    pafEntregas: [
      { id: t('kit'), tema: 'cliente_ideal', titulo: ideal.entregas[0].titulo, version: 'v1', fecha: d(-2), enlace: DRIVE, publicada: true, estado: 'en_revision', decision: ideal.entregas[0].decision, hasta: d(5), canal: 'mail' },
      { id: t('inf'), tema: 'diagnostico', titulo: diag.entregas[0].titulo, decision: diag.entregas[0].decision, canal: 'mail', publicada: false },
    ],
    pafResumenes: [{
      id: t('r1'), fecha: d(-12), publicado: true,
      acuerdos: 'El objetivo es conseguir más proyectos de vivienda unifamiliar en zona norte.\nDecide Lucía; Martín participa en las reuniones de contenido.',
      proximosPasos: 'De tu lado:\n- Marcar los 3 proyectos favoritos en Materiales\nDe nuestro lado:\n- Preparar el Excel de cliente ideal y explicarlo en la próxima reunión',
    }],
    pafAnuncios: [
      { id: t('an1'), ...BIENVENIDA_PAF, publicado: true, fijado: true, creadoEn: iso(-14) },
      { id: t('an2'), titulo: 'Ya tenés el Kit v1 para revisar', texto: 'Está en Entregas. Leelo con calma y decinos si ese foco representa al estudio.', publicado: true, creadoEn: iso(-2) },
    ],
    pafReportes: [{
      id: t('rep'), desde: d(-13), hasta: d(-7), publicado: true, creadoEn: iso(-7),
      hicimos: '- Reunión de arranque\n- Reunión de cliente ideal: completamos una fila juntos',
      aprobaste: '- Formulario de arranque\n- Accesos a Instagram, Google y la web',
      falta: '- Completar el Excel de cliente ideal (las partes acordadas)',
      viene: '- Devolución del kit y del diagnóstico',
      numeros: 'Punto de partida: 1.240 seguidores · 3 publicaciones por mes (Instagram, últimos 30 días)',
    }],
    pafHistorial: [
      { fecha: iso(-1), texto: 'El cliente avisó que terminó: Completar el Excel de cliente ideal' },
      { fecha: iso(-2), texto: 'Entrega publicada: Kit de cliente ideal, nicho y oferta v1' },
      { fecha: iso(-8), texto: 'Hito confirmado: Nos organizamos — Objetivo y responsables confirmados en la reunión de arranque' },
      { fecha: iso(-10), texto: 'Empezó el tema Cliente ideal, nicho y oferta' },
      { fecha: iso(-14), texto: 'Cliente creado; empezó el tema Arranque' },
    ],
    proximaAccion: { texto: 'Revisar el Excel que mandó y preparar la devolución', responsable: 'yo', fecha: d(2), necesita: 'Cruzarlo con el diagnóstico', actualizada: iso(0) },
  };

  const meetings: Omit<AgendaMeeting, 'id' | 'createdAt' | 'projectId'>[] = [
    { title: '[Ejemplo] Reunión de arranque · Estudio Bosque', date: d(-12), time: '11:00', durationHours: 1.5, completed: true, tema: 'arranque', sinCalendar: true, projectName: project.clientName },
    { title: '[Ejemplo] Cliente ideal, nicho y oferta · Estudio Bosque', date: d(-9), time: '11:00', durationHours: 1.5, completed: true, tema: 'cliente_ideal', sinCalendar: true, projectName: project.clientName },
    {
      title: '[Ejemplo] Devolución de cliente ideal y diagnóstico · Estudio Bosque', date: d(6), time: '11:00', durationHours: 1.5, completed: false, tema: 'diagnostico', sinCalendar: true, projectName: project.clientName,
      objetivo: 'Mostrar el kit y el diagnóstico, y decidir qué priorizar', preparar: 'Tus comentarios sobre el Kit v1', conCM: true,
      prep: { saleCon: 'Foco y oferta confirmados', decide: 'Si el nicho de vivienda unifamiliar en zona norte lo representa', mostrar: 'Kit v1 y primeras conclusiones del diagnóstico', pedir: 'Referencias de 3 competidores', ojo: 'Martín no conoce el Excel' },
    },
  ];

  return { project, meetings };
}
