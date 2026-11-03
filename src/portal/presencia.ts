/**
 * PLAN DE PRESENCIA: los 9 temas del método, agrupados en los 5 hitos que ve el cliente.
 * Sale de las guías de "PAF - ENTREGA DEL SERVICIO / 02_PRESENCIA_PASO_A_PASO".
 * Cada tema trae lo que se le pide al estudio, la entrega de .CERO, su reunión y el
 * checklist "está completo cuando". Se carga por cliente cuando el tema empieza.
 */
import type { PafResponsable } from './model';

export type TemaId = 'arranque' | 'cliente_ideal' | 'diagnostico' | 'mensaje' | 'contenido' | 'instagram' | 'google' | 'web' | 'cierre';
/** Lo que se contrata aparte: si no está en el alcance, el tema no aparece ni cuenta */
export type Servicio = 'contenido' | 'google' | 'web';
export const SERVICIOS: { id: Servicio; label: string; hint: string }[] = [
  { id: 'contenido', label: 'Contenido e Instagram', hint: 'Con la community manager' },
  { id: 'google', label: 'Google Business', hint: 'Perfil, datos, fotos y reseñas' },
  { id: 'web', label: 'Web o landing', hint: 'Textos, publicación y medición' },
];

export interface TemaPlantilla {
  id: TemaId;
  titulo: string;
  hito: number; // 1 a 5
  servicio?: Servicio;
  objetivo: string;
  completoCuando: string[];
  reunion?: { titulo: string; objetivo: string; preparar?: string; conCM?: boolean; horas: number };
  tareas: { titulo: string; paraQue: string; detalle?: string; pideArchivos?: boolean; responsable?: PafResponsable }[];
  entregas: { titulo: string; decision: string; canal?: string }[];
}

export const PRESENCIA_TEMAS: TemaPlantilla[] = [
  {
    id: 'arranque', titulo: 'Arranque', hito: 1,
    objetivo: 'Confirmar objetivo, participantes, canales y la siguiente acción.',
    completoCuando: ['Respuestas del formulario revisadas', 'Objetivo y responsabilidades confirmados', 'Canales y accesos pedidos', 'Siguiente acción acordada'],
    reunion: { titulo: 'Reunión de arranque', objetivo: 'Conocernos, confirmar el objetivo y cómo vamos a trabajar', preparar: 'Quién decide en el estudio y qué esperás de estos meses', conCM: true, horas: 1.5 },
    tareas: [
      { titulo: 'Completar el formulario de arranque', paraQue: 'Con estos datos organizamos tu carpeta y preparamos la primera reunión.', detalle: 'Si un dato ya nos lo pasaste, alcanza con confirmarlo.' },
      { titulo: 'Compartir accesos a Instagram, Google y tu web', paraQue: 'Para revisar cómo está hoy tu presencia y trabajar sobre tus cuentas.', detalle: 'Como colaborador o acceso delegado: las cuentas siguen a tu nombre. Nunca nos pases contraseñas por chat.' },
      { titulo: 'Marcar tus 3 proyectos favoritos en Materiales', paraQue: 'Son la base de las primeras publicaciones y de tu portfolio.', detalle: 'Renders, fotos y videos de obra de cada uno, en su carpeta.', pideArchivos: true },
    ],
    entregas: [],
  },
  {
    id: 'cliente_ideal', titulo: 'Cliente ideal, nicho y oferta', hito: 2,
    objetivo: 'Definir a quién le hablamos, en qué nicho y con qué oferta, con tus proyectos reales.',
    completoCuando: ['Excel explicado y una fila completada juntos', 'Partes acordadas del Excel recibidas', 'Kit revisado con el estudio', 'Cliente ideal, nicho y oferta confirmados (o pendientes visibles)'],
    reunion: { titulo: 'Reunión de cliente ideal, nicho y oferta', objetivo: 'Explicar el Excel y completar una fila juntos', preparar: 'Pensá en 2 o 3 clientes con los que te gustó trabajar', horas: 1.5 },
    tareas: [
      { titulo: 'Completar el Excel de cliente ideal (las partes acordadas)', paraQue: 'Con tus proyectos y clientes reales definimos a quién conviene hablarle.', detalle: 'Usá historias reales y dejá vacío lo que no sepas. No hace falta llenar todo: solo las hojas que acordamos.' },
    ],
    entregas: [{ titulo: 'Kit de cliente ideal, nicho y oferta', decision: 'si este foco representa al estudio y qué compromisos puede sostener', canal: 'mail' }],
  },
  {
    id: 'diagnostico', titulo: 'Diagnóstico, competencia y metas', hito: 2,
    objetivo: 'Entender el punto de partida, cómo está la competencia y qué metas son posibles.',
    completoCuando: ['Referencias y datos de partida recibidos', 'Competencia relevada con fuentes', 'Metas orientativas acordadas con el estudio'],
    reunion: { titulo: 'Devolución de cliente ideal y diagnóstico', objetivo: 'Mostrar el kit y el diagnóstico, y decidir qué priorizar', horas: 1.5 },
    tareas: [
      { titulo: 'Pasarnos referencias y competidores', paraQue: 'Para comparar con quién te eligen o te descartan, y ver qué no está haciendo nadie.', detalle: 'Estudios que admires o con los que compitas. Si no sabés, lo vemos juntos.' },
    ],
    entregas: [{ titulo: 'Informe de diagnóstico y metas', decision: 'qué priorizar y qué metas orientativas usar', canal: 'mail' }],
  },
  {
    id: 'mensaje', titulo: 'Mensaje y marca', hito: 3,
    objetivo: 'Llevar la estrategia a las palabras del estudio: frase, presentación y tono.',
    completoCuando: ['Hoja de mensaje enviada', 'Versión aprobada por quien decide', 'Disponible para la web y la CM'],
    reunion: { titulo: 'Reunión de mensaje', objetivo: 'Acordar la frase, la presentación y el tono', preparar: 'Cómo le explicás hoy a un cliente qué hacés', conCM: true, horas: 1 },
    tareas: [
      { titulo: 'Revisar la hoja de mensaje', paraQue: 'Que las palabras te representen antes de usarlas en tus canales.', detalle: 'Marcá lo que no suene a vos o lo que no puedas prometer.' },
    ],
    entregas: [{ titulo: 'Hoja de mensaje', decision: 'qué palabras usar y qué no prometer', canal: 'mail' }],
  },
  {
    id: 'contenido', titulo: 'Estrategia de contenido', hito: 4, servicio: 'contenido',
    objetivo: 'Que sepas qué vamos a publicar y para qué: pilares, formatos, frecuencia y cómo se aprueba.',
    completoCuando: ['Pilares de contenido aprobados', 'Formatos y frecuencia definidos', 'Plan del mes aprobado', 'Ciclo semanal explicado (jueves propuesta, lunes 12 h aprobación)', 'Material con 3 favoritos marcados', 'Primeras piezas publicadas'],
    reunion: { titulo: 'Reunión de contenido', objetivo: 'Presentar los pilares y el plan del mes', conCM: true, horas: 1 },
    tareas: [
      { titulo: 'Mandar el registro de obra de la semana', paraQue: 'Es lo que hace que tu contenido sea real y no genérico.', detalle: 'Imaginate que somos un cliente muy exigente que quiere ver el paso a paso: mandanos lo que le mandarías a él.', pideArchivos: true },
      { titulo: 'Aprobar la propuesta de la semana (hasta el lunes 12 h)', paraQue: 'Para que se publique a tiempo lo que aprobaste.', detalle: 'La propuesta llega el jueves en Gestión de contenido.' },
    ],
    entregas: [{ titulo: 'Pilares y plan del mes', decision: 'el plan del mes', canal: 'la app de contenido' }],
  },
  {
    id: 'instagram', titulo: 'Instagram', hito: 4, servicio: 'contenido',
    objetivo: 'Que quien te descubre entienda en 5 segundos qué hacés, para quién, dónde y cómo escribirte.',
    completoCuando: ['Foto, nombre y bio nuevos', 'Link a la web (o a WhatsApp)', 'Destacadas fijas y una por obra en curso', '3 publicaciones fijadas', 'Publicaciones a archivar aprobadas', 'Cambios aplicados'],
    reunion: { titulo: 'Reestructura de Instagram', objetivo: 'Revisar la bio, las destacadas y qué se archiva', conCM: true, horas: 1 },
    tareas: [
      { titulo: 'Aprobar qué publicaciones se archivan', paraQue: 'Nada se archiva sin tu aprobación.' },
    ],
    entregas: [{ titulo: 'Propuesta de perfil (bio, destacadas y fijados)', decision: 'la bio y qué se archiva', canal: 'mail' }],
  },
  {
    id: 'google', titulo: 'Google Business', hito: 4, servicio: 'google',
    objetivo: 'Que el estudio aparezca bien en Google: servicio, zona, datos, fotos y reseñas.',
    completoCuando: ['Titularidad y acceso verificados', 'Datos, categorías y fotos actualizados', 'Cambios aprobados y aplicados'],
    tareas: [
      { titulo: 'Darnos acceso a tu perfil de Google', paraQue: 'Para actualizarlo sin que pierdas la titularidad.', detalle: 'Como administrador: el perfil sigue a tu nombre.' },
      { titulo: 'Pedir reseñas a clientes con los que trabajaste bien', paraQue: 'Las reseñas reales son lo que más pesa cuando alguien te encuentra.', detalle: 'Te pasamos el link y un mensaje modelo.' },
    ],
    entregas: [{ titulo: 'Propuesta de cambios en Google', decision: 'los datos, categorías y fotos', canal: 'mensaje' }],
  },
  {
    id: 'web', titulo: 'Web, landing y medición', hito: 4, servicio: 'web',
    objetivo: 'Definir qué conservar y qué cambiar, preparar los textos, publicar y medir.',
    completoCuando: ['Estructura y textos aprobados', 'Publicada y probada en celular y escritorio', 'Medición configurada'],
    reunion: { titulo: 'Validación de la web', objetivo: 'Revisar la versión antes de publicarla', horas: 1 },
    tareas: [
      { titulo: 'Revisar la web antes de publicar', paraQue: 'Que lo publicado sea exactamente lo que aprobaste.', detalle: 'Probala en el celular y en la compu. Marcá lo que cambiarías.' },
    ],
    entregas: [{ titulo: 'Web o landing para aprobar', decision: 'si está lista para publicar', canal: 'mail' }],
  },
  {
    id: 'cierre', titulo: 'Cierre de Presencia', hito: 5,
    objetivo: 'Que veas lo que construimos, lo que quedó pendiente y decidas con información cómo seguimos.',
    completoCuando: ['Resultados registrados: lo aprobado, lo publicado y lo medido', 'Pendientes con responsable y fecha', 'Metas revisadas contra el punto de partida', 'Informe de cierre enviado', 'Siguiente paso registrado: continuar, pausar o terminar'],
    reunion: { titulo: 'Reunión de cierre de Presencia', objetivo: 'Repasar resultados y decidir cómo seguimos', horas: 1 },
    tareas: [],
    entregas: [{ titulo: 'Informe de cierre de Presencia', decision: 'cómo seguimos: continuar, pausar o terminar', canal: 'reunión' }],
  },
];

export const temaPorId = (id: TemaId) => PRESENCIA_TEMAS.find((t) => t.id === id)!;

/** Los temas que corresponden según lo que contrató (los de base siempre) */
export function temasDelAlcance(alcance: Servicio[] = []): TemaPlantilla[] {
  return PRESENCIA_TEMAS.filter((t) => !t.servicio || alcance.includes(t.servicio));
}

/** Estado de un tema en la ficha de un cliente */
export interface TemaEstado {
  empezado?: string; // YYYY-MM-DD
  checks?: boolean[];
}
export type TemaFase = 'sin_empezar' | 'en_curso' | 'esperando' | 'completo';
export const TEMA_FASE_LABEL: Record<TemaFase, string> = { sin_empezar: 'Sin empezar', en_curso: 'En curso', esperando: 'Esperando al cliente', completo: 'Completo' };

export function faseDelTema(
  tema: TemaPlantilla,
  estado: TemaEstado | undefined,
  tareas: { tema?: TemaId; estado: string; responsable?: PafResponsable }[]
): TemaFase {
  const checks = estado?.checks || [];
  if (tema.completoCuando.length && tema.completoCuando.every((_, i) => checks[i])) return 'completo';
  if (!estado?.empezado) return 'sin_empezar';
  const delTema = tareas.filter((t) => t.tema === tema.id);
  if (delTema.some((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio')) return 'esperando';
  return 'en_curso';
}

/** Lo que se carga al empezar un tema: tareas ocultas y entregas por preparar (sin repetir) */
export function kitDelTema(
  tema: TemaPlantilla,
  existentes: { tareas: { titulo: string }[]; entregas: { titulo: string }[] },
  newId: () => string
) {
  const tituloT = new Set(existentes.tareas.map((t) => t.titulo.trim().toLowerCase()));
  const tituloE = new Set(existentes.entregas.map((e) => e.titulo.trim().toLowerCase()));
  return {
    tareas: tema.tareas.filter((t) => !tituloT.has(t.titulo.toLowerCase())).map((t) => ({ ...t, id: newId(), tema: tema.id, estado: 'borrador' as const })),
    entregas: tema.entregas.filter((e) => !tituloE.has(e.titulo.toLowerCase())).map((e) => ({ id: newId(), tema: tema.id, titulo: e.titulo, decision: e.decision, ...(e.canal ? { canal: e.canal } : {}), publicada: false })),
  };
}
