// La caja "Novedad": Juan escribe una línea (con o sin link) y sale al portal.
// Sin elegir tipos: se entiende sola si es una novedad, una entrega o un pedido para el cliente.
import type { PafAnnouncement, PafDelivery, PafTask } from './model';
import { safeHttpsUrl } from './model';
import { conHistorial } from './historial';

export type NovedadTipo = 'novedad' | 'entrega' | 'pedido';
export const NOVEDAD_TIPO_LABEL: Record<NovedadTipo, string> = { novedad: 'Novedad', entrega: 'Entrega', pedido: 'Pedido al cliente' };
export const NOVEDAD_TIPO_HINT: Record<NovedadTipo, string> = {
  novedad: 'Lo lee en “Lo último”.',
  entrega: 'Queda también en sus Entregas, con el link.',
  pedido: 'Le aparece como tarea, con el botón “Terminé”.',
};

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
const FIN = '(?=\\s|$|[,.:;!])';
const PEDIDO_RE = new RegExp(`^(necesito|necesitamos|sub[ií]|subime|mandame|mandanos|pasame|pasanos|complet[aá]|eleg[ií]|revis[aá]|aprob[aá]|confirmame|contame|decime|grab[aá]|sac[aá]|envi[aá]|enviame|por favor)${FIN}|te toca|de tu lado`, 'i');
const ENTREGA_RE = /(entreg|borrador|versi[oó]n|propuesta|informe|diagn[oó]stico|dise[ñn]o|qued[oó] list|ya est[aá]|termin)/i;

/** Separa el texto del link (el primero que encuentre) y adivina de qué se trata */
export function leerNovedad(raw: string): { texto: string; link: string | null; tipo: NovedadTipo } {
  const m = URL_RE.exec(raw);
  const cruda = m ? m[0].replace(/[),.;]+$/, '') : '';
  const link = cruda ? safeHttpsUrl(/^https?:\/\//i.test(cruda) ? cruda : `https://${cruda}`) : null;
  const texto = (m ? raw.replace(m[0], ' ') : raw).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  const tipo: NovedadTipo = PEDIDO_RE.test(texto) ? 'pedido' : link && ENTREGA_RE.test(texto) ? 'entrega' : 'novedad';
  return { texto, link, tipo };
}

type ProyectoNovedad = {
  clientName: string;
  pafAnuncios?: PafAnnouncement[];
  pafEntregas?: PafDelivery[];
  pafTareas?: PafTask[];
  pafHistorial?: { fecha: string; texto: string }[];
};

/** Lo que hay que guardar en el proyecto para publicar la novedad (o el error, si no se puede) */
export function aplicarNovedad(
  project: ProyectoNovedad,
  raw: string,
  opts: { tipo?: NovedadTipo; fijar?: boolean; now?: string; newId: () => string }
): { updates: Partial<ProyectoNovedad>; tipo: NovedadTipo } | { error: string } {
  const leida = leerNovedad(raw);
  const tipo = opts.tipo || leida.tipo;
  const now = opts.now || new Date().toISOString();
  if (!leida.texto) return { error: leida.link ? 'Sumá una frase que diga qué es ese link.' : 'Escribí la novedad.' };
  if (URL_RE.test(raw) && !leida.link) return { error: 'El link no parece válido: tiene que empezar con https://' };
  const corto = leida.texto.split('\n')[0].slice(0, 140);
  const link = leida.link;

  if (tipo === 'entrega') {
    const entrega: PafDelivery = { id: opts.newId(), titulo: corto, publicada: true, fecha: now.slice(0, 10), ...(link ? { enlace: link } : {}) };
    return { tipo, updates: { pafEntregas: [...(project.pafEntregas || []), entrega], ...conHistorial(project, `Entrega publicada: ${corto}`) } };
  }
  if (tipo === 'pedido') {
    const resto = leida.texto.split('\n').slice(1).join('\n').trim();
    const tarea: PafTask = { id: opts.newId(), titulo: corto, estado: 'habilitada', habilitadaEn: now, ...(resto ? { detalle: resto } : {}), ...(link ? { link } : {}) };
    return { tipo, updates: { pafTareas: [...(project.pafTareas || []), tarea], ...conHistorial(project, `Tarea habilitada: ${corto}`) } };
  }
  const anuncio: PafAnnouncement = { id: opts.newId(), texto: leida.texto.slice(0, 1000), publicado: true, creadoEn: now, ...(link ? { link } : {}), ...(opts.fijar ? { fijado: true } : {}) };
  return { tipo, updates: { pafAnuncios: [...(project.pafAnuncios || []), anuncio], ...conHistorial(project, `Novedad publicada: ${corto}`) } };
}

/** Última vez que Juan le mostró algo al cliente (YYYY-MM-DD), para saber si el portal está quieto */
export function ultimaNovedad(p: Pick<ProyectoNovedad, 'pafAnuncios' | 'pafEntregas' | 'pafTareas'>): string | null {
  const dias = [
    ...(p.pafAnuncios || []).filter((a) => a.publicado).map((a) => a.creadoEn),
    ...(p.pafEntregas || []).filter((d) => d.publicada).map((d) => d.fecha || ''),
    ...(p.pafTareas || []).flatMap((t) => [t.habilitadaEn || '', t.aprobacion?.fecha || '']),
  ].map((d) => d.slice(0, 10)).filter(Boolean).sort();
  return dias.pop() || null;
}

/** "hoy", "ayer", "hace 5 días" */
export function haceCuanto(fecha: string, today: string): string {
  const dias = Math.round((Date.parse(today.slice(0, 10)) - Date.parse(fecha.slice(0, 10))) / 86400000);
  if (!Number.isFinite(dias)) return '';
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}
