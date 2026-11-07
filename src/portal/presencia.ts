/**
 * PLAN DE PRESENCIA: los 9 temas del método, agrupados en los 5 hitos que ve el cliente.
 * Sale de las guías de "PAF - ENTREGA DEL SERVICIO / 02_PRESENCIA_PASO_A_PASO".
 * Cada tema trae lo que se le pide al estudio, la entrega de .CERO, su reunión y el
 * checklist "está completo cuando". Se carga por cliente cuando el tema empieza.
 */
import type { PafResponsable } from './model';

export type TemaId =
  | 'arranque' | 'cliente_ideal' | 'diagnostico' | 'mensaje' | 'contenido' | 'instagram' | 'google' | 'web' | 'cierre'
  | 'a_captacion' | 'a_campanas' | 'a_embudo' | 'a_casos' | 'a_guiones' | 'a_vsl' | 'a_lanzamiento' | 'a_medicion'
  | 'f_registro' | 'f_respuesta' | 'f_reunion' | 'f_presupuesto' | 'f_campanas' | 'f_material' | 'f_ia' | 'f_practica' | 'f_cierre';

/** Las tres etapas del método. Una etapa empieza solo cuando Juan la activa (nunca por fecha o pago). */
export type Etapa = 'presencia' | 'adquisicion' | 'conversion';
export const ETAPAS: { id: Etapa; label: string; pregunta: string; borrador?: boolean }[] = [
  { id: 'presencia', label: 'Presencia', pregunta: '¿Se entiende qué hacés, para quién y por qué elegirte?' },
  { id: 'adquisicion', label: 'Adquisición', pregunta: '¿Te encuentran, todas las semanas, personas parecidas a tu cliente ideal?', borrador: true },
  { id: 'conversion', label: 'Conversión', pregunta: 'De los que te escriben, ¿cuántos terminás reuniendo, presupuestando y cerrando?', borrador: true },
];
/** Hitos que ve el cliente en cada etapa */
export const ETAPA_HITOS: Record<Etapa, { titulo: string; trabajo: string; seCompleta: string }[]> = {
  presencia: [
    { titulo: 'Nos organizamos', trabajo: 'Arranque, objetivo, participantes, canales, datos y materiales necesarios.', seCompleta: 'Objetivo y responsabilidades confirmados; siguiente acción acordada.' },
    { titulo: 'Definimos el foco', trabajo: 'Cliente ideal, nicho y oferta; diagnóstico, competencia y metas.', seCompleta: 'Kit y prioridades revisados; decisiones esenciales confirmadas.' },
    { titulo: 'Acordamos el mensaje', trabajo: 'Frase, presentación, tono y aplicaciones.', seCompleta: 'Versión del mensaje confirmada por quien decide.' },
    { titulo: 'Lo llevamos a tus canales', trabajo: 'Contenido e Instagram con la CM; Google Business, web y medición según alcance.', seCompleta: 'Trabajo contratado aplicado y comprobado.' },
    { titulo: 'Revisamos y cerramos', trabajo: 'Resultados, evidencias, indicadores disponibles, pendientes y continuidad.', seCompleta: 'Cierre compartido y decisión de continuidad registrada.' },
  ],
  adquisicion: [
    { titulo: 'Preparamos la captación', trabajo: 'Cómo filtrar y registrar consultas, y la estrategia de campañas.', seCompleta: 'Registro y formulario funcionando; presupuesto y tope aprobados.' },
    { titulo: 'Creamos lo que atrae', trabajo: 'Contenido para atraer, casos de éxito, guiones y video de ventas.', seCompleta: 'Piezas aprobadas y listas para publicar.' },
    { titulo: 'Lanzamos', trabajo: 'Campañas activas y etapa de aprendizaje.', seCompleta: 'Campañas activas y consultas registradas.' },
    { titulo: 'Medimos', trabajo: 'Primer reporte con números reales y qué ajustar.', seCompleta: 'Reporte leído y ajustes acordados.' },
  ],
  conversion: [
    { titulo: 'Ordenamos las consultas', trabajo: 'Registro completo de prospectos y cómo responder.', seCompleta: 'Registro en uso y protocolo de respuesta aprobado.' },
    { titulo: 'Reunión y propuesta', trabajo: 'Reunión comercial, presupuesto y seguimiento.', seCompleta: 'Guion, modelo de presupuesto y secuencia aprobados.' },
    { titulo: 'Mejoramos las campañas', trabajo: 'Qué anuncios siguen y por qué, según la calidad de las consultas.', seCompleta: 'Campañas ajustadas y cambios registrados.' },
    { titulo: 'Material y práctica', trabajo: 'Material educativo, herramientas de IA y práctica con casos reales.', seCompleta: 'Material aprobado y práctica con devoluciones.' },
    { titulo: 'Cierre del programa', trabajo: 'Informe final y reunión de cierre.', seCompleta: 'Informe entregado y siguiente paso decidido.' },
  ],
};
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
  /** Etapa (por defecto Presencia) */
  etapa?: Etapa;
  /** Etapa por desarrollar: el contenido es un borrador a revisar antes de usarlo con un cliente */
  borrador?: boolean;
  hito: number; // dentro de su etapa
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

// Adquisición y Conversión: armados con los módulos de "POR_DESARROLLAR". Son borrador.
const A = (t: Omit<TemaPlantilla, 'etapa' | 'borrador'>): TemaPlantilla => ({ ...t, etapa: 'adquisicion', borrador: true });
const F = (t: Omit<TemaPlantilla, 'etapa' | 'borrador'>): TemaPlantilla => ({ ...t, etapa: 'conversion', borrador: true });

export const ADQUISICION_TEMAS: TemaPlantilla[] = [
  A({ id: 'a_captacion', titulo: 'Calificación y registro de consultas', hito: 1,
    objetivo: 'Que cada consulta llegue con lo necesario para saber si encaja, y quede anotada.',
    completoCuando: ['Preguntas y reglas de calificación aprobadas', 'Formulario funcionando en la landing', 'Registro mínimo en uso'],
    tareas: [{ titulo: 'Aprobar las preguntas del formulario y las reglas de filtro', paraQue: 'Para recibir consultas que encajan y saber cuáles priorizar.' }, { titulo: 'Anotar cada consulta en el registro', paraQue: 'Sin registro no se puede medir qué trae cada campaña.' }],
    entregas: [{ titulo: 'Formulario y registro de consultas', decision: 'las preguntas y las reglas de filtro', canal: 'mail' }] }),
  A({ id: 'a_campanas', titulo: 'Estrategia de campañas', hito: 1,
    objetivo: 'Definir a quién, dónde, con qué mensaje y con qué presupuesto se pauta.',
    completoCuando: ['Inversión anterior revisada', 'Presupuesto y tope aprobados', 'Estrategia aprobada'],
    reunion: { titulo: 'Reunión de estrategia de campañas', objetivo: 'Acordar presupuesto, tope y anuncios', preparar: 'Lo que invertiste antes en publicidad y cómo te fue', horas: 1 },
    tareas: [{ titulo: 'Contarnos lo que invertiste antes y cómo te fue', paraQue: 'Para no repetir lo que no funcionó.' }],
    entregas: [{ titulo: 'Estrategia de campañas', decision: 'el presupuesto, el tope y los anuncios', canal: 'mail' }] }),
  A({ id: 'a_embudo', titulo: 'Contenido para atraer', hito: 2,
    objetivo: 'Que cada pieza le hable a alguien en su momento: descubrir, evaluar o decidir.',
    completoCuando: ['Calendario del mes con objetivo de cada pieza', 'Calendario aprobado'],
    reunion: { titulo: 'Reunión de contenido para atraer', objetivo: 'Presentar el calendario del mes por etapa del embudo', conCM: true, horas: 1 },
    tareas: [{ titulo: 'Aprobar el calendario del mes', paraQue: 'Para publicar con objetivo y no por publicar.' }],
    entregas: [{ titulo: 'Calendario del mes (embudo)', decision: 'el calendario', canal: 'la app de contenido' }] }),
  A({ id: 'a_casos', titulo: 'Casos de éxito', hito: 2,
    objetivo: 'Mostrar 2 o 3 obras reales contadas como casos: problema, solución y resultado.',
    completoCuando: ['Obras elegidas', 'Fotos, datos y testimonios recibidos', 'Casos publicados en la web e Instagram'],
    tareas: [{ titulo: 'Elegir las obras y pedir los testimonios', paraQue: 'Un caso real convence más que cualquier frase.', pideArchivos: true }],
    entregas: [{ titulo: 'Casos de éxito', decision: 'los casos antes de publicarlos', canal: 'mail' }] }),
  A({ id: 'a_guiones', titulo: 'Guiones y grabación', hito: 2,
    objetivo: 'Videos cortos con guion, grabados por el estudio.',
    completoCuando: ['Guiones aprobados', 'Videos grabados', 'Videos editados y publicados'],
    tareas: [{ titulo: 'Grabar los videos con los guiones', paraQue: 'Tu cara y tu voz generan confianza.' }],
    entregas: [{ titulo: 'Guiones de video', decision: 'los guiones', canal: 'mail' }] }),
  A({ id: 'a_vsl', titulo: 'Video de ventas', hito: 2,
    objetivo: 'Un video en la landing que explique la oferta y lleve a consultar.',
    completoCuando: ['Guion aprobado', 'Video grabado', 'Versión final aprobada y publicada'],
    tareas: [{ titulo: 'Grabar el video de ventas', paraQue: 'Es lo que ve quien llega a tu landing antes de consultar.' }],
    entregas: [{ titulo: 'Guion del video de ventas', decision: 'el guion y la versión final', canal: 'mail' }] }),
  A({ id: 'a_lanzamiento', titulo: 'Lanzamiento y aprendizaje', hito: 3,
    objetivo: 'Activar las campañas y aprender de las primeras consultas.',
    completoCuando: ['Campañas activas', 'Aviso de etapa de aprendizaje', 'Consultas respondidas y calificadas'],
    tareas: [{ titulo: 'Responder las consultas y avisar cuáles fueron buenas', paraQue: 'Con eso ajustamos a quién le mostramos los anuncios.' }],
    entregas: [] }),
  A({ id: 'a_medicion', titulo: 'Medición y primer reporte', hito: 4,
    objetivo: 'Ver los números reales y decidir qué ajustar.',
    completoCuando: ['Reporte con números reales', 'Reporte leído con el estudio', 'Ajustes acordados'],
    reunion: { titulo: 'Reunión del primer reporte', objetivo: 'Leer los números y decidir qué ajustar', preparar: 'Tus dudas sobre el reporte', horas: 1 },
    tareas: [{ titulo: 'Leer el reporte y traer dudas', paraQue: 'Para decidir juntos con números reales.' }],
    entregas: [{ titulo: 'Primer reporte de captación', decision: 'qué ajustar', canal: 'reunión' }] }),
];

export const CONVERSION_TEMAS: TemaPlantilla[] = [
  F({ id: 'f_registro', titulo: 'Registro completo de prospectos', hito: 1,
    objetivo: 'Un registro donde cada consulta tiene su estado y su próximo paso.',
    completoCuando: ['Registro armado', 'En uso todos los días'],
    tareas: [{ titulo: 'Usar el registro todos los días', paraQue: 'Para que ninguna consulta se pierda.' }],
    entregas: [{ titulo: 'Registro de prospectos', decision: 'cómo lo vas a usar', canal: 'reunión' }] }),
  F({ id: 'f_respuesta', titulo: 'Responder consultas', hito: 1,
    objetivo: 'Responder rápido y bien, con mensajes modelo.',
    completoCuando: ['Protocolo de respuesta aprobado', 'Mensajes aplicados en consultas reales'],
    tareas: [{ titulo: 'Aplicar los mensajes en tus consultas', paraQue: 'Una buena primera respuesta define si hay reunión.' }],
    entregas: [{ titulo: 'Protocolo de respuesta', decision: 'los mensajes modelo', canal: 'mail' }] }),
  F({ id: 'f_reunion', titulo: 'Reunión comercial', hito: 2,
    objetivo: 'Una reunión que entiende al cliente, muestra el valor y responde objeciones.',
    completoCuando: ['Guion y objeciones aprobados', 'Reuniones reales practicadas'],
    reunion: { titulo: 'Práctica de reunión comercial', objetivo: 'Ensayar el guion y las objeciones', horas: 1 },
    tareas: [{ titulo: 'Practicar y grabar tus reuniones (con permiso)', paraQue: 'Para darte devoluciones concretas.' }],
    entregas: [{ titulo: 'Guion de reunión comercial', decision: 'el guion y las respuestas a objeciones', canal: 'mail' }] }),
  F({ id: 'f_presupuesto', titulo: 'Presupuesto y seguimiento', hito: 2,
    objetivo: 'Presupuestos claros y un seguimiento que no deja propuestas sin respuesta.',
    completoCuando: ['Modelo de presupuesto aprobado', 'Secuencia de seguimiento aprobada', 'Aplicada a presupuestos abiertos'],
    tareas: [{ titulo: 'Aplicar la secuencia a tus presupuestos abiertos', paraQue: 'Muchos trabajos se pierden por no hacer seguimiento.' }],
    entregas: [{ titulo: 'Modelo de presupuesto y seguimiento', decision: 'el modelo y la secuencia', canal: 'mail' }] }),
  F({ id: 'f_campanas', titulo: 'Optimización de campañas', hito: 3,
    objetivo: 'Seguir lo que trae consultas buenas y apagar lo que no.',
    completoCuando: ['Campañas ajustadas', 'Registro de cambios al día'],
    tareas: [{ titulo: 'Seguir avisando qué consultas fueron buenas', paraQue: 'Es lo que guía cada ajuste.' }],
    entregas: [] }),
  F({ id: 'f_material', titulo: 'Material educativo', hito: 4,
    objetivo: '2 o 3 PDFs con tu marca que ayuden al cliente a decidir.',
    completoCuando: ['Contenido técnico revisado', 'PDFs aprobados'],
    tareas: [{ titulo: 'Revisar el contenido técnico', paraQue: 'Que lo que explicamos sea exacto.' }],
    entregas: [{ titulo: 'Material educativo', decision: 'los PDFs', canal: 'mail' }] }),
  F({ id: 'f_ia', titulo: 'Herramientas de IA', hito: 4,
    objetivo: 'Una librería de prompts para responder, presupuestar y seguir más rápido.',
    completoCuando: ['Librería entregada', 'Explicada en una sesión'],
    tareas: [],
    entregas: [{ titulo: 'Librería de prompts', decision: 'si te sirve como está', canal: 'reunión' }] }),
  F({ id: 'f_practica', titulo: 'Práctica con casos reales', hito: 4,
    objetivo: 'Revisar conversaciones reales y mejorar con devoluciones concretas.',
    completoCuando: ['Casos compartidos', 'Devoluciones dadas en las sesiones'],
    tareas: [{ titulo: 'Compartir grabaciones o capturas de conversaciones', paraQue: 'Para darte devoluciones sobre casos reales.' }],
    entregas: [] }),
  F({ id: 'f_cierre', titulo: 'Cierre del programa', hito: 5,
    objetivo: 'Ver todo lo construido, los resultados y decidir cómo seguimos.',
    completoCuando: ['Informe final enviado', 'Reunión de cierre hecha', 'Siguiente paso registrado'],
    reunion: { titulo: 'Reunión de cierre del programa', objetivo: 'Repasar resultados y decidir cómo seguimos', horas: 1 },
    tareas: [],
    entregas: [{ titulo: 'Informe final del programa', decision: 'cómo seguimos', canal: 'reunión' }] }),
];

export const TODOS_LOS_TEMAS: TemaPlantilla[] = [...PRESENCIA_TEMAS, ...ADQUISICION_TEMAS, ...CONVERSION_TEMAS];
export const temaPorId = (id: TemaId) => TODOS_LOS_TEMAS.find((t) => t.id === id)!;
export const etapaDelTema = (t: TemaPlantilla): Etapa => t.etapa || 'presencia';

/** Los temas de una etapa que corresponden según lo que contrató (los de base siempre) */
export function temasDelAlcance(alcance: Servicio[] = [], etapa: Etapa = 'presencia'): TemaPlantilla[] {
  return TODOS_LOS_TEMAS.filter((t) => etapaDelTema(t) === etapa && (!t.servicio || alcance.includes(t.servicio)));
}

/** Estado de un tema en la ficha de un cliente */
export interface TemaEstado {
  empezado?: string; // YYYY-MM-DD
  /** Cuándo se sumó a tu agenda lo tuyo de este tema (YYYY-MM-DD) */
  agendado?: string;
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
