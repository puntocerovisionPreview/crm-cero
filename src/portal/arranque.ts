/**
 * ALTA SIN TALLY ("alta nueva"): el estudio completa sus datos adentro del portal y el CRM
 * crea sus carpetas en el Drive de .CERO copiando las carpetas modelo.
 * Se prende cliente por cliente (project.pafAltaNueva): los demás siguen con Tally y la planilla.
 * Lógica pura: la usan el portal, el servidor, la ficha y los tests.
 */
import type { AltaLinks } from './altaLinks';

export type PreguntaTipo = 'texto' | 'largo' | 'email' | 'tel' | 'opciones';
export interface PreguntaArranque {
  id: string;
  label: string;
  tipo: PreguntaTipo;
  requerida?: boolean;
  ayuda?: string;
  opciones?: string[];
}

/** Las mismas preguntas que tenía el formulario de Tally, más cortas */
export const PREGUNTAS_ARRANQUE: PreguntaArranque[] = [
  { id: 'estudio', label: '¿Cómo se llama tu estudio?', tipo: 'texto', requerida: true },
  { id: 'contacto', label: 'Tu nombre y tu rol', tipo: 'texto', requerida: true, ayuda: 'Ej.: David, socio fundador' },
  { id: 'whatsapp', label: 'Tu WhatsApp, con código de país', tipo: 'tel', requerida: true, ayuda: 'Ej.: +54 9 11 2345 6789' },
  { id: 'emailCarpeta', label: '¿A qué correo de Google te compartimos tu carpeta?', tipo: 'email', requerida: true, ayuda: 'Con ese correo vas a poder subir tus materiales.' },
  { id: 'aprueba', label: '¿Quién revisa y aprueba el trabajo?', tipo: 'largo', ayuda: 'Si participan otras personas: nombre, rol y correo.' },
  { id: 'ciudad', label: '¿En qué ciudad y país están?', tipo: 'texto' },
  { id: 'horarios', label: '¿Qué días y horarios suelen tener para reunirnos?', tipo: 'largo', ayuda: 'En tu horario local.' },
  { id: 'links', label: 'Los links que ya usan', tipo: 'largo', ayuda: 'Web, Instagram y ficha de Google, si tienen.' },
  { id: 'materiales', label: '¿Qué materiales tienen?', tipo: 'opciones', opciones: ['Fotos de proyectos', 'Renders', 'Videos', 'Logo e identidad', 'Fotos del equipo', 'Todavía no lo sabemos', 'Otro'] },
  { id: 'carpetaExistente', label: 'Si ya tienen una carpeta con materiales, pegá el link', tipo: 'texto', ayuda: 'No cambies sus permisos: la pedimos nosotros si hace falta.' },
  { id: 'restricciones', label: '¿Hay proyectos, imágenes o datos que no podamos mostrar?', tipo: 'largo', ayuda: 'Si hace falta pedir autorización, avisanos.' },
  { id: 'ausencias', label: '¿Vacaciones, ausencias o fechas a tener en cuenta?', tipo: 'largo' },
];

export type RespuestasArranque = Record<string, string | string[]>;

export interface PafArranque {
  respuestas: RespuestasArranque;
  /** Correo con el que entró al portal */
  email: string;
  enviadoEn: string;
  estado: 'creando' | 'listo' | 'error';
  error?: string;
  carpetas?: AltaLinks;
  /** Correo con el que se compartió su carpeta */
  compartidaCon?: string;
  actualizadoEn: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = { texto: 200, largo: 1500, email: 120, tel: 40 } as const;

/** Limpia lo que manda el portal: solo las preguntas conocidas, recortadas, y dice qué falta */
export function limpiarRespuestas(raw: unknown): { respuestas: RespuestasArranque; errores: string[] } {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const respuestas: RespuestasArranque = {};
  const errores: string[] = [];
  for (const p of PREGUNTAS_ARRANQUE) {
    const v = src[p.id];
    if (p.tipo === 'opciones') {
      const lista = (Array.isArray(v) ? v : []).map(String).filter((x) => p.opciones!.includes(x));
      if (lista.length) respuestas[p.id] = [...new Set(lista)];
    } else {
      const texto = String(v ?? '').trim().replace(/\s+\n/g, '\n').slice(0, MAX[p.tipo]);
      if (texto) respuestas[p.id] = p.tipo === 'email' ? texto.toLowerCase() : texto;
    }
    if (p.requerida && !respuestas[p.id]) errores.push(`Falta: ${p.label}`);
  }
  const email = respuestas.emailCarpeta as string | undefined;
  if (email && !EMAIL_RE.test(email)) errores.push('El correo no es válido.');
  return { respuestas, errores };
}

/** Lo que se copió del modelo, con su ruta de nombres desde la carpeta raíz */
export interface ItemCopiado { ruta: string[]; url: string; carpeta: boolean }

const norm = (s: string) => s.trim().toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');

/**
 * Las partes de la carpeta del estudio (igual que las devolvía el script): por cómo termina
 * el nombre, así sirve con "01_Para_completar", "02_Materiales", "01_Proyectos", etc.
 */
export function partesDe(compartida: { url: string; items: ItemCopiado[] }, interna?: { url: string; items: ItemCopiado[] }): AltaLinks {
  const out: AltaLinks = { carpetaCompartida: compartida.url };
  const arriba = (re: RegExp) => compartida.items.find((i) => i.carpeta && i.ruta.length === 1 && re.test(norm(i.ruta[0])));
  const para = arriba(/para completar$/);
  const mat = arriba(/materiales$/);
  const res = arriba(/resultados$/);
  if (para) out.paraCompletar = para.url;
  if (mat) out.materiales = mat.url;
  if (res) out.resultados = res.url;
  if (mat) {
    const sub = (re: RegExp) => compartida.items.find((i) => i.carpeta && i.ruta.length === 2 && i.ruta[0] === mat.ruta[0] && re.test(norm(i.ruta[1])))?.url;
    out.proyectos = sub(/proyectos$/);
    out.equipo = sub(/equipo/);
    out.referencias = sub(/referencias$/);
    out.registro = sub(/registro/);
  }
  if (para) out.excelClienteIdeal = compartida.items.find((i) => !i.carpeta && i.ruta.length === 2 && i.ruta[0] === para.ruta[0] && /cliente ideal/.test(norm(i.ruta[1])))?.url;
  if (interna) {
    out.carpetaInterna = interna.url;
    out.ficha = interna.items.find((i) => !i.carpeta && i.ruta.length === 1 && /ficha/.test(norm(i.ruta[0])))?.url;
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as AltaLinks;
}

export type PasoAltaEstado = 'hecho' | 'esperando' | 'error' | 'pendiente';
export interface PasoAlta { id: string; label: string; estado: PasoAltaEstado; detalle?: string }

/** El semáforo del alta en la ficha: en qué paso está y qué falta */
export function semaforoAlta(p: {
  pafClienteId?: string;
  pafPortal?: { publishedAt?: string };
  pafArranque?: PafArranque;
  pafDrive?: { carpetaCompartida?: string };
}): PasoAlta[] {
  const a = p.pafArranque;
  const carpetas = a?.carpetas?.carpetaCompartida || p.pafDrive?.carpetaCompartida;
  return [
    { id: 'id', label: 'ID creado', estado: p.pafClienteId ? 'hecho' : 'pendiente', detalle: p.pafClienteId },
    { id: 'portal', label: 'Portal publicado', estado: p.pafPortal?.publishedAt ? 'hecho' : 'pendiente' },
    { id: 'formulario', label: 'Completó sus datos', estado: a?.enviadoEn ? 'hecho' : p.pafPortal?.publishedAt ? 'esperando' : 'pendiente', detalle: a?.enviadoEn ? a.enviadoEn.slice(0, 10).split('-').reverse().join('/') : undefined },
    { id: 'carpetas', label: 'Carpetas creadas', estado: carpetas ? 'hecho' : a?.estado === 'error' ? 'error' : a?.estado === 'creando' ? 'esperando' : 'pendiente', detalle: a?.estado === 'error' ? a.error : undefined },
    { id: 'compartida', label: 'Carpeta compartida', estado: a?.compartidaCon ? 'hecho' : carpetas && a?.estado === 'error' ? 'error' : 'pendiente', detalle: a?.compartidaCon },
  ];
}
