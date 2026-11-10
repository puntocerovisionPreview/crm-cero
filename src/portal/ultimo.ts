// "Lo último": la historia de lo que fue pasando, armada solo con lo que el cliente ya puede ver
// en su portal publicado (anuncios, entregas, resúmenes de reunión, tareas aprobadas, reportes).
import type { PafPortalDoc } from './model';

export type UltimoTipo = 'novedad' | 'mensaje' | 'entrega' | 'reunion' | 'tarea' | 'reporte';
export interface UltimoItem {
  key: string;
  tipo: UltimoTipo;
  fecha: string; // YYYY-MM-DD
  titulo?: string;
  texto?: string;
  link?: string;
  /** El link es una imagen: se muestra en el lugar */
  imagen?: string;
  fijado?: boolean;
  /** Clave de "nuevo desde tu última visita" (las mismas de portalItemKeys) */
  nuevoKey?: string;
}

const VIDEO_RE = /(^|\.)(loom\.com|youtube\.com|youtu\.be|vimeo\.com)$/i;
const IMAGEN_RE = /\.(png|jpe?g|webp|gif|avif)$/i;

/** Un link a Loom, YouTube o Vimeo: se muestra como "un mensaje para vos" */
export function esVideo(link?: string): boolean {
  try { return !!link && VIDEO_RE.test(new URL(link).hostname); } catch { return false; }
}
export function esImagen(link?: string): boolean {
  try { return !!link && IMAGEN_RE.test(new URL(link).pathname); } catch { return false; }
}

const primeraLinea = (s?: string) => (s || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).find(Boolean) || '';

export function ultimoDelPortal(p: Pick<PafPortalDoc, 'anuncios' | 'entregas' | 'reuniones' | 'tareas' | 'reportes'>, max = 30): UltimoItem[] {
  const items: UltimoItem[] = [
    ...(p.anuncios || []).map((a): UltimoItem => ({
      key: `a:${a.id}`, nuevoKey: `a:${a.id}`, fecha: a.fecha,
      tipo: esVideo(a.link) ? 'mensaje' : 'novedad',
      ...(a.titulo ? { titulo: a.titulo } : {}), texto: a.texto,
      ...(a.link ? (esImagen(a.link) ? { imagen: a.link } : { link: a.link }) : {}),
      ...(a.fijado ? { fijado: true } : {}),
    })),
    ...(p.entregas || []).filter((e) => e.fecha).map((e): UltimoItem => ({
      key: `e:${e.id}`, nuevoKey: `e:${e.id}`, fecha: e.fecha!, tipo: 'entrega',
      titulo: `${e.titulo}${e.version ? ` ${e.version}` : ''}`,
      ...(e.decision ? { texto: `Para que decidas: ${e.decision}` } : {}),
      ...(e.enlace ? { link: e.enlace } : {}),
    })),
    ...(p.reuniones || []).map((r): UltimoItem => ({
      key: `r:${r.fecha}`, nuevoKey: `r:${r.fecha}`, fecha: r.fecha, tipo: 'reunion',
      titulo: 'Nos reunimos', texto: primeraLinea(r.acuerdos) || primeraLinea(r.proximosPasos),
    })),
    ...(p.tareas || []).filter((t) => t.estado === 'aprobada' && t.aprobadaEl).map((t): UltimoItem => ({
      key: `t:${t.id}`, fecha: t.aprobadaEl!, tipo: 'tarea', titulo: `Listo de tu lado: ${t.titulo}`,
    })),
    ...(p.reportes || []).map((r): UltimoItem => ({
      key: `rp:${r.id}`, fecha: r.hasta, tipo: 'reporte', titulo: 'Resumen de la semana', texto: primeraLinea(r.hicimos),
    })),
  ];
  return items
    .filter((i) => /^\d{4}-\d{2}-\d{2}/.test(i.fecha))
    .sort((a, b) => Number(!!b.fijado) - Number(!!a.fijado) || b.fecha.localeCompare(a.fecha))
    .slice(0, max);
}
