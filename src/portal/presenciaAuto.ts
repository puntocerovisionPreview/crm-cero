/**
 * PRESENCIA CASI AUTOMÁTICA: lo que sale de "PAF - ENTREGA DEL SERVICIO" para cada cliente.
 * - Cuándo conviene empezar cada tema (semana sugerida desde que arrancó: es una referencia,
 *   las fechas reales se acuerdan con cada estudio).
 * - Lo que hacés vos en cada tema (las guías "Trabajo nuestro"), como tareas de tu agenda con fecha.
 * - Los accesos que hacen falta según lo que contrató, con su estado y el mensaje para pedirlos.
 * Funciones puras: no mandan nada ni agendan reuniones.
 */
import type { AgendaTask, Project } from '../types';
import { temasDelAlcance, type Servicio, type TemaId, type TemaPlantilla } from './presencia';

const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
const dias = (desde: string, hasta: string) => Math.floor((Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86400000);

/** Semana del programa (1 = la primera) en la que conviene empezar cada tema de Presencia */
export const SEMANA_SUGERIDA: Partial<Record<TemaId, number>> = {
  arranque: 1, cliente_ideal: 1, contenido: 1,
  diagnostico: 2, mensaje: 2,
  instagram: 3, google: 3, web: 3,
  cierre: 4,
};

/** Lo tuyo en cada tema: `dia` = días después de empezarlo */
export const TRABAJO_NUESTRO: Partial<Record<TemaId, { titulo: string; dia: number; detalle?: string }[]>> = {
  arranque: [
    { titulo: 'Leer traspaso y propuesta, y completar "Antes de recibir un cliente"', dia: 0, detalle: 'Qué se vendió, quién decide, reuniones, CM, web y cuentas acordadas.' },
    { titulo: 'Revisar las respuestas del Tally y la ficha privada', dia: 0, detalle: 'Anotá solo lo que falta: no repitas preguntas en la reunión.' },
    { titulo: 'Preparar las 5 líneas de la reunión de arranque', dia: 1, detalle: 'Qué quiero que salga, qué decide, qué muestro, qué le pido y qué cuido.' },
    { titulo: 'Mandar "Hoy acordamos" y actualizar la ficha', dia: 3 },
  ],
  cliente_ideal: [
    { titulo: 'Duplicar el Excel de cliente ideal en su carpeta (Para completar)', dia: 0, detalle: 'Nunca el modelo maestro.' },
    { titulo: 'Preparar un ejemplo de resultado y las 5 líneas de la reunión', dia: 1, detalle: 'Cliente ideal en una línea, frase de nicho y oferta, marcados como ficticios.' },
    { titulo: 'Armar el Kit de cliente ideal, nicho y oferta', dia: 7, detalle: 'Con lo que completó en el Excel: Modelo_Kit.' },
  ],
  diagnostico: [
    { titulo: 'Pedirle referencias y competidores', dia: 0, detalle: 'Quién le gana proyectos y a quién admira. La investigación es nuestra.' },
    { titulo: 'Revisar su web, perfiles y competencia con capturas fechadas', dia: 2 },
    { titulo: 'Completar el Excel de diagnóstico interno', dia: 4, detalle: 'Privado: no se comparte.' },
    { titulo: 'Escribir el informe de diagnóstico y metas', dia: 7, detalle: 'Separá observaciones de hipótesis. Modelo_Informe.' },
  ],
  mensaje: [
    { titulo: 'Sacar del kit qué hace, para quién, zona, diferencias y objeciones', dia: 0 },
    { titulo: 'Preparar opciones de frase y bio con tu recomendación', dia: 2 },
    { titulo: 'Completar la hoja de mensaje y mandarla a validar', dia: 5, detalle: 'Modelo_Hoja_de_mensaje. Guardá la aprobación con fecha y versión.' },
  ],
  contenido: [
    { titulo: 'Pasarle a la CM el brief de contenido y el material', dia: 0 },
    { titulo: 'Coordinar con la CM la primera propuesta de la semana', dia: 2 },
  ],
  instagram: [
    { titulo: 'Revisar su perfil: bio, link, destacadas y fijados', dia: 0 },
    { titulo: 'Armar la propuesta de perfil con la hoja de mensaje', dia: 2 },
  ],
  google: [
    { titulo: 'Ver si tiene perfil de Google y quién lo administra', dia: 0 },
    { titulo: 'Preparar descripción, servicios y fotos autorizadas', dia: 3, detalle: 'Sin categorías inventadas ni palabras extra en el nombre.' },
    { titulo: 'Aplicar lo aprobado en Google, probar y guardar captura', dia: 7 },
  ],
  web: [
    { titulo: 'Decidir qué conservar, cambiar o crear en su web', dia: 0 },
    { titulo: 'Escribir estructura y textos de la web', dia: 5, detalle: 'TEXTOS_ESTRATEGICOS_WEB.' },
    { titulo: 'Checklist de publicación y medición', dia: 14, detalle: 'Formulario de prueba recibido, HTTPS, sin bloqueo de indexación, Search Console y medición comprobada.' },
  ],
  cierre: [
    { titulo: 'Comparar lo acordado con lo realizado', dia: 0 },
    { titulo: 'Escribir el informe de cierre de Presencia', dia: 3 },
  ],
};

// ---------- Accesos ----------

export type AccesoId = 'instagram' | 'facebook' | 'google_business' | 'web' | 'dominio' | 'analytics' | 'search_console';
export type AccesoEstadoId = 'falta' | 'pedido' | 'concedido' | 'no_aplica';
export interface AccesoEstado { estado: AccesoEstadoId; fecha?: string }
export interface AccesoPlantilla { id: AccesoId; label: string; como: string; servicio: Servicio }

/** Lo que hace falta pedir, según lo contratado. Siempre con invitación: nunca contraseñas. */
export const ACCESOS: AccesoPlantilla[] = [
  { id: 'instagram', label: 'Instagram', como: 'como socio desde Meta Business Suite (Configuración → Personas)', servicio: 'contenido' },
  { id: 'facebook', label: 'Página de Facebook', como: 'con acceso a la página en Meta Business Suite', servicio: 'contenido' },
  { id: 'google_business', label: 'Perfil de Google Business', como: 'como administrador (no propietario) desde el perfil → Personas y acceso', servicio: 'google' },
  { id: 'web', label: 'Panel de la web o del hosting', como: 'con un usuario administrador para nosotros', servicio: 'web' },
  { id: 'dominio', label: 'Dominio', como: 'con acceso delegado, o coordinamos juntos el cambio de DNS', servicio: 'web' },
  { id: 'analytics', label: 'Google Analytics', como: 'como editor', servicio: 'web' },
  { id: 'search_console', label: 'Search Console', como: 'como usuario con permisos completos', servicio: 'web' },
];
export const ACCESO_ESTADO_LABEL: Record<AccesoEstadoId, string> = { falta: 'Falta pedir', pedido: 'Pedido', concedido: 'Lo tenemos', no_aplica: 'No aplica' };

export const accesosDelAlcance = (alcance: Servicio[] = []) => ACCESOS.filter((a) => alcance.includes(a.servicio));
export const estadoAcceso = (p: Pick<Project, 'pafAccesos'>, id: AccesoId): AccesoEstado => p.pafAccesos?.[id] || { estado: 'falta' };

/** Mensaje de WhatsApp para pedir los accesos que faltan (lo manda Juan). '' si no falta ninguno. */
export function mensajeAccesos(nombre: string, faltan: AccesoPlantilla[], correo: string): string {
  if (!faltan.length) return '';
  return [
    `Hola ${nombre}, para avanzar con tus canales necesitamos que nos des acceso a:`,
    ...faltan.map((a) => `• ${a.label}: ${a.como}.`),
    '',
    `La invitación va a ${correo}. Las cuentas siguen a tu nombre y podés sacarnos el acceso cuando quieras. Nunca nos pases contraseñas ni códigos por acá.`,
    'Si alguno no sabés cómo hacerlo, lo vemos juntos en la próxima reunión.',
  ].join('\n');
}

// ---------- Plan de la semana ----------

/** Desde cuándo cuenta el programa: el inicio de Presencia, o el de la mentoría/proyecto */
export const inicioPrograma = (p: Project): string | undefined => p.pafEtapasInicio?.presencia || p.pafStartDate || p.startDate || p.pafTemas?.arranque?.empezado;
export const semanaDelPrograma = (inicio: string, today: string) => Math.max(1, Math.floor(dias(inicio, today) / 7) + 1);

/** Temas de Presencia (según lo contratado) que ya tocaría empezar y siguen sin empezar */
export function temasParaEmpezar(p: Project, today: string): TemaPlantilla[] {
  const inicio = inicioPrograma(p);
  if (!inicio || (p.pafEtapa && p.pafEtapa !== 'presencia')) return [];
  const semana = semanaDelPrograma(inicio, today);
  return temasDelAlcance(p.pafAlcance || [], 'presencia')
    .filter((t) => !p.pafTemas?.[t.id]?.empezado && (SEMANA_SUGERIDA[t.id] ?? 99) <= semana);
}

/** Temas empezados cuyo trabajo tuyo todavía no está en tu agenda */
export const temasSinAgenda = (p: Project): TemaPlantilla[] =>
  temasDelAlcance(p.pafAlcance || [], 'presencia').filter((t) => p.pafTemas?.[t.id]?.empezado && !p.pafTemas?.[t.id]?.agendado && TRABAJO_NUESTRO[t.id]?.length);

/** Lo tuyo de un tema como tareas de agenda (con el cliente vinculado). Nunca antes de hoy. */
export function tareasNuestras(t: TemaPlantilla, p: Pick<Project, 'id' | 'clientName'>, desde: string, today: string): Omit<AgendaTask, 'id' | 'createdAt'>[] {
  return (TRABAJO_NUESTRO[t.id] || []).map((x) => {
    const fecha = addDays(desde, x.dia);
    return {
      title: `${x.titulo} · ${p.clientName}`,
      date: fecha < today ? today : fecha,
      completed: false,
      projectId: p.id,
      projectName: p.clientName,
      ...(x.detalle ? { notes: `${t.titulo}: ${x.detalle}` } : { notes: t.titulo }),
    };
  });
}

/** Accesos pedidos hace más de `dias` días sin respuesta */
export function accesosDemorados(p: Project, today: string, plazo = 5): AccesoPlantilla[] {
  return accesosDelAlcance(p.pafAlcance || []).filter((a) => {
    const e = estadoAcceso(p, a.id);
    return e.estado === 'pedido' && !!e.fecha && dias(e.fecha, today) > plazo;
  });
}
