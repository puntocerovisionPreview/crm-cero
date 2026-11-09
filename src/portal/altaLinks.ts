/**
 * LINKS DEL ALTA → FICHA Y PORTAL. El script de Drive devuelve los links de la carpeta del
 * estudio (y si está actualizado, los de cada parte: Para completar, Materiales y sus
 * subcarpetas, Resultados y el Excel de cliente ideal). Esto los reparte:
 * - en la ficha (pafDrive), para que queden guardados
 * - en el portal: accesos "Tu carpeta / Para completar / Materiales / Resultados" y las
 *   subcarpetas de Materiales (cada tarea sube a la suya)
 * - en las tareas que abren un archivo (ej. el Excel de cliente ideal)
 * Solo agrega lo nuevo: lo que ya estaba (o que borraste del portal) no se vuelve a sumar.
 */
import type { MaterialKey, PafAccess, PafDriveLinks, PafPortalDraft, PafTask } from './model';
import { temaPorId } from './presencia';

export interface AltaLinks {
  carpetaCompartida?: string;
  carpetaInterna?: string;
  ficha?: string;
  materiales?: string;
  paraCompletar?: string;
  resultados?: string;
  proyectos?: string;
  equipo?: string;
  referencias?: string;
  registro?: string;
  excelClienteIdeal?: string;
}

const https = (u?: string) => (u && /^https:\/\//i.test(u.trim()) ? u.trim() : undefined);
const DRIVE_KEYS: (keyof PafDriveLinks)[] = ['carpetaCompartida', 'carpetaInterna', 'ficha', 'materiales', 'paraCompletar', 'resultados', 'excelClienteIdeal'];
const ACCESOS: { key: keyof AltaLinks; nombre: string }[] = [
  { key: 'carpetaCompartida', nombre: 'Tu carpeta' },
  { key: 'paraCompletar', nombre: 'Para completar' },
  { key: 'materiales', nombre: 'Materiales' },
  { key: 'resultados', nombre: 'Resultados' },
];
const SUBCARPETAS: MaterialKey[] = ['proyectos', 'equipo', 'referencias', 'registro'];
/** Tareas que abren un archivo del alta: título de la plantilla → link */
const ABRE: Record<string, keyof AltaLinks> = {
  'Completar el Excel de cliente ideal (las partes que vimos juntos)': 'excelClienteIdeal',
};

export function aplicarAlta(
  actual: { pafDrive?: PafDriveLinks; pafTareas?: PafTask[] },
  draft: PafPortalDraft,
  alta: AltaLinks | undefined,
  newId: () => string,
): { pafDrive: PafDriveLinks; draft: PafPortalDraft; pafTareas?: PafTask[] } | null {
  if (!alta) return null;
  const drive = actual.pafDrive || {};
  // Lo nuevo: lo que el alta trae y la ficha todavía no tenía guardado
  const nuevos = DRIVE_KEYS.filter((k) => https(alta[k as keyof AltaLinks]) && !drive[k]);
  const subNuevas = SUBCARPETAS.filter((k) => https(alta[k]) && !(drive.subcarpetas || {})[k]);
  if (!nuevos.length && !subNuevas.length) return null;

  const pafDrive: PafDriveLinks = {
    ...drive,
    ...Object.fromEntries(nuevos.map((k) => [k, https(alta[k as keyof AltaLinks])])),
    ...(subNuevas.length ? { subcarpetas: { ...(drive.subcarpetas || {}), ...Object.fromEntries(subNuevas.map((k) => [k, https(alta[k])])) } } : {}),
  };

  // Portal: accesos de las partes de la carpeta (solo las nuevas) y subcarpetas de Materiales
  const accesos: PafAccess[] = [...(draft.accesos || [])];
  ACCESOS.filter((a) => nuevos.includes(a.key as keyof PafDriveLinks) && !accesos.some((x) => x.url === https(alta[a.key])))
    .forEach((a) => accesos.push({ id: newId(), nombre: a.nombre, url: https(alta[a.key])! }));
  const materiales = { ...(draft.materiales || {}) };
  subNuevas.forEach((k) => { if (!materiales[k]) materiales[k] = https(alta[k]); });
  const enlaces = { ...draft.enlaces };
  if (!enlaces.carpeta && https(alta.carpetaCompartida)) enlaces.carpeta = https(alta.carpetaCompartida);
  if (!enlaces.materiales && https(alta.materiales)) enlaces.materiales = https(alta.materiales);
  if (!enlaces.resultados && https(alta.resultados)) enlaces.resultados = https(alta.resultados);

  // Tareas que abren un archivo del alta y todavía no tienen link
  let pafTareas: PafTask[] | undefined;
  const tareas = actual.pafTareas || [];
  if (tareas.some((t) => !t.link && ABRE[t.titulo] && https(alta[ABRE[t.titulo]]))) {
    pafTareas = tareas.map((t) => (!t.link && ABRE[t.titulo] && https(alta[ABRE[t.titulo]]) ? { ...t, link: https(alta[ABRE[t.titulo]]) } : t));
  }

  return { pafDrive, draft: { ...draft, accesos, materiales, enlaces }, ...(pafTareas ? { pafTareas } : {}) };
}

/** Link que una tarea de plantilla abre al cargarse (si el alta ya lo trajo) */
export const linkDeTarea = (titulo: string, drive?: PafDriveLinks): string | undefined => {
  const k = ABRE[titulo];
  return k ? https((drive as Record<string, string | undefined> | undefined)?.[k]) : undefined;
};

// La plantilla tiene que seguir existiendo con ese título (si cambia, el test lo avisa)
export const _titulosQueAbren = () => Object.keys(ABRE).map((t) => temaPorId('cliente_ideal').tareas.some((x) => x.titulo === t));
