/**
 * PORTAL DEL CLIENTE PAF (con cuenta de Google)
 *
 * - Lo que ve el estudio vive en paf_portal/{clienteId} (ej. PAF-002).
 * - Solo lo leen los correos de emailsAutorizados, con su propia cuenta de Google
 *   (ver firestore.rules). El ID no sirve como llave: pegar la URL o el ID no alcanza.
 * - Lo arma el CRM a partir de lo que Juan decide publicar (project.pafPortal).
 *   Nunca lleva notas internas, ficha privada, respuestas de Tally ni la carpeta interna.
 * Lógica pura: la usan la app y los tests.
 */

export const PAF_PORTAL_COLLECTION = 'paf_portal';

/** Los 5 hitos de Presencia que muestra el portal (Adquisición y Conversión todavía no van) */
export const PRESENCIA_HITOS = [
  'Nos organizamos',
  'Definimos el foco',
  'Acordamos el mensaje',
  'Lo llevamos a tus canales',
  'Revisamos y cerramos',
] as const;

/** PAF-002, PAF-PRUEBA-001, WEB-001… Un ID no se reutiliza nunca. */
export const CLIENTE_ID_RE = /^(PAF-(PRUEBA-|EJEMPLO-)?|WEB-)\d{3,}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PafPortalLinkKey = 'carpeta' | 'materiales' | 'resultados' | 'web' | 'asana';
export const PAF_PORTAL_LINK_LABEL: Record<PafPortalLinkKey, string> = {
  carpeta: 'Tu carpeta',
  materiales: 'Materiales',
  resultados: 'Resultados',
  web: 'Tu web',
  asana: 'Calendario de contenido',
};
export const PAF_PORTAL_LINK_KEYS = Object.keys(PAF_PORTAL_LINK_LABEL) as PafPortalLinkKey[];

/** Lo que Juan carga en la ficha (privado, queda en el proyecto) */
export interface PafPortalDraft {
  emails: string[];
  hito: number; // 1 a 5
  resumen: string;
  enlaces: Partial<Record<PafPortalLinkKey, string>>;
  /** Accesos directos libres (nombre y link, en este orden). Si no hay, salen de `enlaces`. */
  accesos?: PafAccess[];
  /** Mostrar la etapa, la barra y el paso a paso en el portal (por defecto sí) */
  mostrarAvance?: boolean;
  /** Logo del estudio, ya achicado (data:image/…;base64) */
  logo?: string;
  /** Color de su marca (#rrggbb), para detalles del portal */
  marca?: string;
  /** Link fijo de las reuniones (Meet o Zoom) */
  linkReunion?: string;
  /** Qué secciones ve el cliente (lo que no está, va por defecto) */
  secciones?: Partial<Record<PortalSeccion, boolean>>;
  /** Espacio del estudio en la app de la CM */
  gestionContenido?: string;
  /** PDF de bienvenida del estudio */
  bienvenida?: string;
  /** Subcarpetas de 02_Materiales */
  materiales?: Partial<Record<MaterialKey, string>>;
  /** Reuniones que incluye el acuerdo (si lo define) */
  reunionesAcordadas?: number;
  /** Tus números: los carga Juan con su fuente */
  numeros?: { id: string; label: string; valor: string; fuente: string }[];
  /** "Mientras tanto, nosotros": lo que Juan elige contarle (una línea por cosa). Vacío = no se muestra */
  nosotros?: string;
  publishedAt?: string;
}

/** Secciones del portal que Juan puede mostrar u ocultar */
export type PortalSeccion = 'novedades' | 'proximaAccion' | 'enMarcha' | 'tuMes' | 'numeros' | 'recorrido' | 'anuncios' | 'semana' | 'tareas' | 'reuniones' | 'reunionesAcuerdo' | 'acuerdos' | 'entregas' | 'reportes' | 'materiales' | 'contenido' | 'cicloCM' | 'accesos';
export const PORTAL_SECCIONES: { id: PortalSeccion; label: string; hint: string; porDefecto: boolean }[] = [
  { id: 'novedades', label: 'Desde tu última visita', hint: 'Resumen de lo nuevo arriba de todo', porDefecto: true },
  { id: 'proximaAccion', label: 'Lo de ahora', hint: 'En Inicio, una carta a la vez: lo que le toca y tu devolución juntos', porDefecto: true },
  { id: 'enMarcha', label: 'Mientras tanto, nosotros', hint: 'Lo que le contás que estás haciendo (solo si lo escribís)', porDefecto: true },
  { id: 'recorrido', label: 'Cómo es el programa', hint: 'El detalle de cada hito, plegado al final de Paso a paso. Sin esto ve solo la etapa y el hito actual', porDefecto: false },
  { id: 'tuMes', label: 'Tu mes', hint: 'Resumen del mes armado con tus reportes', porDefecto: true },
  { id: 'numeros', label: 'Tus números', hint: 'Consultas, reuniones, propuestas… los cargás vos', porDefecto: false },
  { id: 'anuncios', label: 'Anuncios', hint: 'Lo que fijás arriba', porDefecto: true },
  { id: 'semana', label: 'Esta semana', hint: 'Foco y objetivos de la semana', porDefecto: true },
  { id: 'tareas', label: 'Tareas', hint: 'Lo que necesitamos de su lado, ordenado en cartas', porDefecto: true },
  { id: 'reuniones', label: 'Próxima reunión', hint: 'Con objetivo y qué preparar', porDefecto: true },
  { id: 'reunionesAcuerdo', label: 'Reuniones del acuerdo', hint: 'Cuántas van de las acordadas', porDefecto: false },
  { id: 'acuerdos', label: 'Lo que acordamos', hint: 'Resumen de cada reunión', porDefecto: true },
  { id: 'entregas', label: 'Entregas', hint: 'Tus devoluciones, en la misma carta que su tarea', porDefecto: true },
  { id: 'reportes', label: 'Reportes', hint: 'El reporte del viernes publicado', porDefecto: false },
  { id: 'materiales', label: 'Materiales', hint: 'Dónde subir cada cosa', porDefecto: true },
  { id: 'contenido', label: 'Gestión de contenido', hint: 'Botón a la app de la CM', porDefecto: true },
  { id: 'cicloCM', label: 'Ritmo del contenido', hint: 'Propuesta el jueves, aprobación el lunes 12 h', porDefecto: false },
  { id: 'accesos', label: 'Accesos', hint: 'Carpetas y links', porDefecto: true },
];
export function seccionesVisibles(s?: Partial<Record<PortalSeccion, boolean>>): Record<PortalSeccion, boolean> {
  return Object.fromEntries(PORTAL_SECCIONES.map((x) => [x.id, s?.[x.id] ?? x.porDefecto])) as Record<PortalSeccion, boolean>;
}

export type MaterialKey = 'proyectos' | 'equipo' | 'referencias' | 'registro';
export const MATERIALES: { id: MaterialKey; label: string; pedido: string }[] = [
  { id: 'proyectos', label: 'Proyectos', pedido: 'Una carpeta por proyecto con su nombre: fotos, renders, planos y videos de obra. Subí todo lo que tengas: después elegimos juntos qué mostrar.' },
  { id: 'equipo', label: 'Equipo y marca', pedido: 'Fotos del equipo, logo y elementos de tu marca.' },
  { id: 'referencias', label: 'Referencias', pedido: 'Campañas anteriores y cuentas o estudios que te gusten.' },
  { id: 'registro', label: 'Registro de obra', pedido: 'Imaginate que somos un cliente muy exigente que quiere ver el paso a paso: mandanos lo que le mandarías a él, aunque parezca chico.' },
];

/** Reporte del viernes (Juan lo arma; el estudio lo ve si se publica) */
export interface PafReporte {
  id: string;
  desde: string; // YYYY-MM-DD
  hasta: string;
  hicimos: string;
  aprobaste: string;
  falta: string;
  viene: string;
  numeros: string;
  publicado: boolean;
  creadoEn: string;
}

/** Acceso directo del portal: Juan elige el nombre (ej. "Contenido en Asana") */
export interface PafAccess {
  id: string;
  nombre: string;
  url: string;
}

/** Anuncio de Juan (privado en el proyecto; el estudio ve los publicados) */
export interface PafAnnouncement {
  id: string;
  texto: string;
  titulo?: string;
  link?: string;
  fijado?: boolean;
  publicado: boolean;
  creadoEn: string; // ISO
}

/** Anuncio tal como lo ve el estudio */
export interface PafPortalAnnouncement {
  id: string;
  texto: string;
  titulo?: string;
  link?: string;
  fijado?: boolean;
  fecha: string; // YYYY-MM-DD
}

/**
 * Tarea del estudio (privada, en el proyecto). El cliente la ve solo cuando Juan la habilita.
 * "Terminé" del cliente la pasa a "enviada"; la aprobación la confirma Juan con fecha y canal.
 */
export type PafTaskState = 'borrador' | 'habilitada' | 'enviada' | 'aprobada';
export const PAF_TASK_STATE_LABEL: Record<PafTaskState, string> = {
  borrador: 'Por preparar',
  habilitada: 'Disponible',
  enviada: 'Recibida · en revisión',
  aprobada: 'Completada',
};

/** Quién hace la tarea */
export type PafResponsable = 'estudio' | 'cero' | 'cm';
export const PAF_RESPONSABLE_LABEL: Record<PafResponsable, string> = { estudio: 'Tu estudio', cero: '.CERO', cm: 'Community manager' };
export interface PafTask {
  id: string;
  titulo: string;
  detalle?: string;
  fecha?: string; // YYYY-MM-DD
  estado: PafTaskState;
  habilitadaEn?: string;
  avisoEn?: string;
  aprobacion?: { fecha: string; canal: string };
  /** Por qué Juan la volvió a habilitar (lo ve el estudio) */
  motivo?: string;
  /** La tarea pide subir archivos: el portal muestra el link a Materiales */
  pideArchivos?: boolean;
  /** A qué subcarpeta de Materiales se suben (por defecto, Proyectos) */
  carpeta?: MaterialKey;
  /** Link que el estudio abre para hacer la tarea (opcional) */
  link?: string;
  /** Su carta va primero en "Ahora" (una sola) */
  prioritaria?: boolean;
  /** Para qué sirve (lo ve el estudio arriba de la explicación) */
  paraQue?: string;
  /** Quién la hace (por defecto, el estudio) */
  responsable?: PafResponsable;
  /** Tema del plan de Presencia al que pertenece */
  tema?: import('./presencia').TemaId;
  /** Carta del portal: vacío = la del tema; "-" = sola; otro texto = carta con ese nombre */
  carta?: string;
}

/** Hito de Presencia que Juan confirmó, con su evidencia (privada: el estudio solo ve cuáles) */
export interface PafHitoConfirmado {
  /** Etapa del hito (por defecto Presencia) */
  etapa?: import('./presencia').Etapa;
  hito: number; // 1 a 5
  fecha: string; // YYYY-MM-DD
  evidencia: string;
}

/** Recorrido de un cliente Web: sus propios hitos (no los de Presencia) */
export const WEB_HITOS = ['Brief', 'Diseño', 'Desarrollo', 'Revisión', 'Publicada'] as const;
export const WEB_HITO_INFO: { trabajo: string; seCompleta: string }[] = [
  { trabajo: 'Objetivo de la web, páginas, contenidos y lo que hay que conservar.', seCompleta: 'Brief aprobado y materiales recibidos.' },
  { trabajo: 'Estructura, estilo y textos de cada página.', seCompleta: 'Diseño y textos aprobados.' },
  { trabajo: 'Armado de la web con lo aprobado, formularios y contacto.', seCompleta: 'Versión completa lista para revisar.' },
  { trabajo: 'Revisión en celular y escritorio, ajustes y pruebas.', seCompleta: 'Versión final aprobada.' },
  { trabajo: 'Publicación en tu dominio, medición y entrega de accesos.', seCompleta: 'Web publicada, probada y medida.' },
];
export type Recorrido = 'presencia' | 'web';
export const hitosDe = (r?: Recorrido, etapa: Etapa = 'presencia'): readonly string[] => (r === 'web' ? WEB_HITOS : ETAPA_HITOS[etapa].map((h) => h.titulo));
export const hitoInfoDe = (r?: Recorrido, etapa: Etapa = 'presencia'): { trabajo: string; seCompleta: string }[] => (r === 'web' ? WEB_HITO_INFO : ETAPA_HITOS[etapa]);

/** Qué agrupa cada hito y cuándo se completa (de la especificación del servicio) */
export const PRESENCIA_HITO_INFO: { trabajo: string; seCompleta: string }[] = [
  { trabajo: 'Arranque, objetivo, participantes, canales, datos y materiales necesarios.', seCompleta: 'Objetivo y responsabilidades confirmados; siguiente acción acordada.' },
  { trabajo: 'Cliente ideal, nicho y oferta; diagnóstico, competencia y metas.', seCompleta: 'Kit y prioridades revisados; decisiones esenciales confirmadas.' },
  { trabajo: 'Frase, presentación, tono y aplicaciones.', seCompleta: 'Versión del mensaje confirmada por quien decide.' },
  { trabajo: 'Contenido e Instagram con la CM; Google Business, web y medición según alcance.', seCompleta: 'Trabajo contratado aplicado y comprobado.' },
  { trabajo: 'Resultados, evidencias, indicadores disponibles, pendientes y continuidad.', seCompleta: 'Cierre compartido y decisión de continuidad registrada.' },
];

/** Hitos confirmados, sin repetir y en orden (lo único que se publica de los hitos) */
export function hitosCompletados(items: PafHitoConfirmado[] = [], etapa: import('./presencia').Etapa = 'presencia'): number[] {
  return [...new Set(items.filter((h) => (h.etapa || 'presencia') === etapa).map((h) => h.hito).filter((n) => Number.isInteger(n) && n >= 1 && n <= PRESENCIA_HITOS.length))].sort((a, b) => a - b);
}

/** Entrega de Juan al estudio: archivo en Drive, se publica cuando él decide */
export interface PafDelivery {
  id: string;
  titulo: string;
  fecha?: string;
  enlace?: string;
  publicada: boolean;
  version?: string;
  /** Qué tiene que decidir o revisar el estudio */
  decision?: string;
  /** Hasta cuándo (YYYY-MM-DD) */
  hasta?: string;
  /** Dónde lo confirma (mail, Asana, reunión…) */
  canal?: string;
  estado?: PafDeliveryState;
  /** Tema del plan de Presencia al que pertenece */
  tema?: import('./presencia').TemaId;
  /** Carta del portal: vacío = la del tema; "-" = sola; otro texto = carta con ese nombre */
  carta?: string;
}
export type PafDeliveryState = 'en_revision' | 'aprobada' | 'ajustes';
export const PAF_DELIVERY_STATE_LABEL: Record<PafDeliveryState, string> = { en_revision: 'Para revisar', aprobada: 'Aprobada', ajustes: 'Con ajustes' };

/** Tarea tal como la ve el cliente */
export interface PafPortalTask {
  id: string;
  titulo: string;
  detalle?: string;
  fecha?: string; // YYYY-MM-DD
  estado: 'habilitada' | 'enviada' | 'aprobada';
  aprobadaEl?: string; // YYYY-MM-DD
  habilitadaEn?: string; // para no mostrar como avisada una tarea que se volvió a habilitar
  motivo?: string; // por qué se volvió a habilitar
  pideArchivos?: boolean; // muestra el link a Materiales
  carpeta?: MaterialKey; // subcarpeta de Materiales donde se sube
  link?: string; // link para hacer la tarea
  prioritaria?: boolean; // su carta va primero en "Ahora"
  paraQue?: string;
  responsable?: PafResponsable;
  /** Carta en la que va (ver pasos.ts) */
  paso?: string;
}

/** Objetivo de la semana (sale de los objetivos del panel del estudio) */
export interface PafPortalGoal {
  texto: string;
  hecho: boolean;
  quien: 'cero' | 'estudio';
}
export interface PafPortalDelivery {
  id: string;
  titulo: string;
  fecha?: string;
  enlace?: string;
  version?: string;
  decision?: string;
  hasta?: string;
  canal?: string;
  estado?: PafDeliveryState;
  /** Carta en la que va (ver pasos.ts) */
  paso?: string;
}

/** Documento paf_portal/{clienteId}: lo único que lee el cliente */
export interface PafPortalDoc {
  clienteId: string;
  estudio: string;
  emailsAutorizados: string[];
  hitoVisible: number;
  resumenVisible: string;
  enlaces: Partial<Record<PafPortalLinkKey, string>>;
  tareas: PafPortalTask[];
  /** IDs de las tareas habilitadas: las reglas solo dejan avisar "Terminé" en estas */
  tareasHabilitadas: string[];
  entregas: PafPortalDelivery[];
  proximaReunion: { fecha: string; hora?: string; objetivo?: string; preparar?: string; conCM?: boolean } | null;
  /** Semana del programa (sale de la fecha de inicio) */
  semana?: { actual: number; total: number } | null;
  /** Resúmenes de reunión publicados (acuerdos y próximos pasos) */
  reuniones?: { fecha: string; acuerdos: string; proximosPasos: string }[];
  /** Accesos directos, en el orden que eligió Juan */
  accesos?: { nombre: string; url: string }[];
  /** Cartas que juntan tareas y entregas (ver pasos.ts) */
  pasos?: import('./pasos').PafPortalPaso[];
  /** Anuncios publicados: fijados primero, después los más nuevos */
  anuncios?: PafPortalAnnouncement[];
  /** Si es false, el portal oculta la etapa, la barra y el paso a paso */
  mostrarAvance?: boolean;
  /** Hitos que Juan confirmó (el avance se cuenta por estos, nunca por fechas) */
  hitosCompletados?: number[];
  /** Presencia (PAF) o Web: cambia los hitos que ve */
  recorrido?: Recorrido;
  /** Etapa del método en la que está y las que contrató (en orden) */
  etapa?: Etapa;
  etapas?: Etapa[];
  /** Lo que está haciendo .CERO o la CM ahora ("Nos toca a nosotros") */
  enMarcha?: { texto: string; quien: 'cero' | 'cm' }[];
  /** Números que carga Juan, con su fuente (nunca calculados) */
  numeros?: { label: string; valor: string; fuente: string }[];
  /** Qué secciones se muestran */
  secciones?: Record<PortalSeccion, boolean>;
  gestionContenido?: string | null;
  bienvenida?: string | null;
  materiales?: Partial<Record<MaterialKey, string>>;
  /** Reuniones del acuerdo: cuántas hay y cuántas se hicieron */
  reunionesAcuerdo?: { total: number; hechas: number } | null;
  /** Reunión propuesta que todavía no tiene día (se ve como "por confirmar") */
  reunionPorConfirmar?: { objetivo?: string } | null;
  reportes?: Omit<PafReporte, 'publicado' | 'creadoEn'>[];
  logo?: string | null;
  marca?: string | null;
  linkReunion?: string | null;
  actualizadoEn: string;
  /** Se publican aparte (ver PORTAL_SEPARATE_FIELDS): objetivos de la semana y WhatsApp de Juan */
  objetivos?: PafPortalGoal[];
  contacto?: { whatsapp?: string };
  /** Contenido para aprobar (sale de las piezas del panel del estudio) */
  piezas?: PafPortalPiece[];
}

/** Campos que no pisa la publicación general (vienen del panel del estudio y de la configuración de Juan) */
export const PORTAL_SEPARATE_FIELDS = ['objetivos', 'contacto', 'piezas'] as const;

/** Semana X de 12 a partir de la fecha de inicio (null si no arrancó o no hay fecha) */
export function programWeek(start: string | undefined, today: string, total = 12): { actual: number; total: number } | null {
  if (!start || !/^\d{4}-\d{2}-\d{2}/.test(start) || start.slice(0, 10) > today) return null;
  const days = Math.floor((Date.parse(today) - Date.parse(start.slice(0, 10))) / 86400000);
  return { actual: Math.min(total, Math.floor(days / 7) + 1), total };
}

/** Solo dígitos, con 549 adelante si es un celular argentino sin código */
export function whatsappDigits(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) return `549${d.slice(2)}`;
  return d.length === 10 ? `549${d}` : d;
}

export function emptyPortalDraft(email?: string): PafPortalDraft {
  return { emails: email ? normalizeEmails(email) : [], hito: 1, resumen: '', enlaces: {} };
}

/** "Ana@x.com, b@y.com" → ['ana@x.com', 'b@y.com'] (sin repetidos) */
export function normalizeEmails(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[\s,;]+/);
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Solo https, sin usuario ni contraseña en la URL */
export function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Arma el documento público. Copia campo por campo lo publicable: nada del proyecto
 * pasa "de arrastre". Devuelve los errores para mostrarlos en la ficha.
 */
export function buildPafPortal(
  input: { clienteId?: string; estudio: string; draft: PafPortalDraft; tareas?: PafPortalTask[]; entregas?: PafPortalDelivery[]; proximaReunion?: PafPortalDoc['proximaReunion']; semana?: PafPortalDoc['semana']; reuniones?: PafPortalDoc['reuniones']; anuncios?: PafPortalAnnouncement[]; privados?: (string | undefined)[]; hitosCompletados?: number[]; recorrido?: Recorrido; etapa?: Etapa; etapas?: Etapa[]; enMarcha?: PafPortalDoc['enMarcha']; reunionesHechas?: number; reunionPorConfirmar?: PafPortalDoc['reunionPorConfirmar']; reportes?: PafReporte[]; pasos?: import('./pasos').PafPortalPaso[] },
  now = new Date().toISOString()
): { doc: PafPortalDoc } | { errors: string[] } {
  const errors: string[] = [];
  const clienteId = (input.clienteId || '').trim().toUpperCase();
  if (!CLIENTE_ID_RE.test(clienteId)) errors.push('Falta el ID del cliente (ej. PAF-002 o PAF-PRUEBA-001).');

  const emails = normalizeEmails(input.draft.emails);
  if (!emails.length) errors.push('Agregá al menos un correo autorizado.');
  const wrong = emails.filter((e) => !EMAIL_RE.test(e));
  if (wrong.length) errors.push(`Correo inválido: ${wrong.join(', ')}`);

  // Los 5 enlaces fijos de antes: solo mientras no se pasaron a accesos libres
  const enlaces: PafPortalDoc['enlaces'] = {};
  for (const key of input.draft.accesos ? [] : PAF_PORTAL_LINK_KEYS) {
    const raw = input.draft.enlaces[key]?.trim();
    if (!raw) continue;
    const url = safeHttpsUrl(raw);
    if (url && isPrivateUrl(url, input.privados)) errors.push(`"${PAF_PORTAL_LINK_LABEL[key]}" es la carpeta interna o la ficha: eso no lo puede ver el estudio.`);
    else if (url) enlaces[key] = url;
    else errors.push(`El enlace "${PAF_PORTAL_LINK_LABEL[key]}" tiene que empezar con https://`);
  }

  // Accesos directos libres (o los 5 enlaces de antes, si todavía no se editaron)
  const accesos: { nombre: string; url: string }[] = [];
  accesos.push(...publishableAccesos(draftAccesos(input.draft), input.privados));

  if (errors.length) return { errors };
  const hito = Math.min(PRESENCIA_HITOS.length, Math.max(1, Math.round(input.draft.hito || 1)));
  // Lo que Juan ocultó no viaja al navegador del cliente
  const ver = seccionesVisibles(input.draft.secciones);
  const materiales = Object.fromEntries((Object.entries(input.draft.materiales || {}) as [MaterialKey, string][])
    .map(([k, v]) => [k, v ? safeHttpsUrl(normalizeLinkInput(v)) : null]).filter(([, v]) => v)) as Partial<Record<MaterialKey, string>>;
  const acordadas = Math.max(0, Math.round(input.draft.reunionesAcordadas || 0));
  return {
    doc: {
      clienteId,
      estudio: input.estudio.trim(),
      emailsAutorizados: emails,
      hitoVisible: hito,
      resumenVisible: input.draft.resumen.trim().slice(0, 2000),
      enlaces,
      tareas: (ver.tareas || ver.proximaAccion ? input.tareas || [] : []).map(({ id, titulo, detalle, fecha, estado, aprobadaEl, habilitadaEn, motivo, pideArchivos, link, prioritaria, paraQue, responsable, paso }) => ({ id, titulo, estado, ...(paso ? { paso } : {}), ...(detalle ? { detalle } : {}), ...(fecha ? { fecha } : {}), ...(aprobadaEl ? { aprobadaEl } : {}), ...(habilitadaEn ? { habilitadaEn } : {}), ...(motivo && estado === 'habilitada' ? { motivo } : {}), ...(pideArchivos ? { pideArchivos: true } : {}), ...(link && safeHttpsUrl(link) ? { link: safeHttpsUrl(link)! } : {}), ...(prioritaria ? { prioritaria: true } : {}), ...(paraQue?.trim() ? { paraQue: paraQue.trim().slice(0, 300) } : {}), ...(responsable && responsable !== 'estudio' ? { responsable } : {}) })),
      tareasHabilitadas: (ver.tareas || ver.proximaAccion ? input.tareas || [] : []).filter((t) => t.estado === 'habilitada').map((t) => t.id),
      entregas: (ver.entregas ? input.entregas || [] : []).map(({ enlace, ...d }) => ({ ...d, ...(enlace && safeHttpsUrl(enlace) ? { enlace: safeHttpsUrl(enlace)! } : {}) })),
      pasos: ver.tareas || ver.proximaAccion || ver.entregas ? input.pasos || [] : [],
      proximaReunion: ver.reuniones ? input.proximaReunion || null : null,
      semana: input.semana || null,
      reuniones: ver.acuerdos ? input.reuniones || [] : [],
      accesos: ver.accesos ? accesos : [],
      anuncios: ver.anuncios ? input.anuncios || [] : [],
      mostrarAvance: input.draft.mostrarAvance !== false,
      hitosCompletados: hitosCompletados((input.hitosCompletados || []).map((hito) => ({ hito, fecha: '', evidencia: '' }))),
      recorrido: input.recorrido === 'web' ? 'web' : 'presencia',
      etapa: input.etapa || 'presencia',
      etapas: input.etapas?.length ? input.etapas : ['presencia'],
      enMarcha: ver.enMarcha ? (input.enMarcha || []).slice(0, 8) : [],
      numeros: ver.numeros ? (input.draft.numeros || []).filter((n) => n.label.trim() && n.valor.trim()).map(({ label, valor, fuente }) => ({ label: label.trim().slice(0, 60), valor: valor.trim().slice(0, 30), fuente: fuente.trim().slice(0, 120) })) : [],
      logo: safeLogo(input.draft.logo),
      marca: safeColor(input.draft.marca),
      linkReunion: input.draft.linkReunion ? safeHttpsUrl(normalizeLinkInput(input.draft.linkReunion)) : null,
      secciones: ver,
      gestionContenido: ver.contenido && input.draft.gestionContenido ? safeHttpsUrl(normalizeLinkInput(input.draft.gestionContenido)) : null,
      bienvenida: input.draft.bienvenida ? safeHttpsUrl(normalizeLinkInput(input.draft.bienvenida)) : null,
      materiales: ver.materiales ? materiales : {},
      reunionesAcuerdo: ver.reunionesAcuerdo && acordadas ? { total: acordadas, hechas: Math.min(acordadas, input.reunionesHechas || 0) } : null,
      reunionPorConfirmar: ver.reuniones ? input.reunionPorConfirmar || null : null,
      reportes: ver.reportes ? (input.reportes || []).filter((r) => r.publicado).sort((a, b) => b.hasta.localeCompare(a.hasta)).slice(0, 6).map(({ publicado: _p, creadoEn: _c, ...r }) => r) : [],
      actualizadoEn: now,
    },
  };
}

// ---------- De la ficha al portal ----------

/** Solo lo habilitado: los borradores no salen nunca */
export function publicTasks(tasks: PafTask[] = []): PafPortalTask[] {
  return tasks
    .filter((t) => t.estado !== 'borrador')
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      estado: t.estado as PafPortalTask['estado'],
      ...pasoDe(t, 't'),
      ...(t.detalle ? { detalle: t.detalle } : {}),
      ...(t.fecha ? { fecha: t.fecha } : {}),
      ...(t.habilitadaEn ? { habilitadaEn: t.habilitadaEn } : {}),
      ...(t.motivo && t.estado === 'habilitada' ? { motivo: t.motivo } : {}),
      ...(t.pideArchivos ? { pideArchivos: true, ...(t.carpeta ? { carpeta: t.carpeta } : {}) } : {}),
      ...(t.link ? { link: t.link } : {}),
      ...(t.prioritaria && t.estado === 'habilitada' ? { prioritaria: true } : {}),
      ...(t.paraQue?.trim() ? { paraQue: t.paraQue.trim() } : {}),
      ...(t.responsable && t.responsable !== 'estudio' ? { responsable: t.responsable } : {}),
      ...(t.estado === 'aprobada' && t.aprobacion ? { aprobadaEl: t.aprobacion.fecha.slice(0, 10) } : {}),
    }));
}

export function publicDeliveries(items: PafDelivery[] = []): PafPortalDelivery[] {
  return items.filter((d) => d.publicada).map(({ id, titulo, fecha, enlace, version, decision, hasta, canal, estado, tema, carta }) => ({
    id, titulo, ...pasoDe({ id, titulo, tema, carta }, 'e'),
    ...(fecha ? { fecha } : {}), ...(enlace ? { enlace } : {}), ...(version?.trim() ? { version: version.trim() } : {}),
    ...(decision?.trim() ? { decision: decision.trim() } : {}), ...(hasta ? { hasta } : {}), ...(canal?.trim() ? { canal: canal.trim() } : {}), ...(estado ? { estado } : {}),
  }));
}

/** Próxima reunión confirmada del proyecto (sin las propuestas sin hora) */
export function nextMeeting(
  meetings: { projectId?: string; date: string; time?: string; completed: boolean; proposed?: boolean; objetivo?: string; preparar?: string; conCM?: boolean }[],
  projectId: string,
  today: string
): PafPortalDoc['proximaReunion'] {
  const next = meetings
    .filter((m) => m.projectId === projectId && !m.completed && !m.proposed && m.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  return next ? {
    fecha: next.date, ...(next.time ? { hora: next.time } : {}),
    ...(next.objetivo?.trim() ? { objetivo: next.objetivo.trim() } : {}), ...(next.preparar?.trim() ? { preparar: next.preparar.trim() } : {}), ...(next.conCM ? { conCM: true } : {}),
  } : null;
}

/** La reunión propuesta (sin día confirmado) más próxima: el cliente la ve como "por confirmar" */
export function meetingPorConfirmar(
  meetings: { projectId?: string; date: string; completed: boolean; proposed?: boolean; objetivo?: string; title?: string }[],
  projectId: string
): PafPortalDoc['reunionPorConfirmar'] {
  const m = meetings.filter((x) => x.projectId === projectId && x.proposed && !x.completed).sort((a, b) => a.date.localeCompare(b.date))[0];
  return m ? { ...(m.objetivo?.trim() ? { objetivo: m.objetivo.trim() } : {}) } : null;
}

export function portalFromProject(
  project: { id: string; clientName: string; pafClienteId?: string; pafPortal?: PafPortalDraft; pafTareas?: PafTask[]; pafEntregas?: PafDelivery[]; pafDrive?: PafDriveLinks; pafStartDate?: string; startDate?: string; pafResumenes?: PafMeetingSummary[]; pafAnuncios?: PafAnnouncement[]; pafHitos?: PafHitoConfirmado[]; pafReportes?: PafReporte[]; serviceType?: string; projectType?: string; pafEtapa?: Etapa; pafEtapasContratadas?: Etapa[] },
  meetings: Parameters<typeof nextMeeting>[0],
  draft: PafPortalDraft = project.pafPortal || emptyPortalDraft(),
  clienteId = project.pafClienteId,
  now = new Date(),
  /** Otros links que el estudio no puede ver (la carpeta interna y la ficha que trajo el script) */
  privados: (string | undefined)[] = []
) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return buildPafPortal(
    {
      clienteId,
      estudio: project.clientName,
      draft,
      tareas: publicTasks(project.pafTareas),
      entregas: publicDeliveries(project.pafEntregas),
      pasos: publicPasos(project.pafTareas, project.pafEntregas),
      proximaReunion: nextMeeting(meetings, project.id, today),
      semana: programWeek(project.pafStartDate || project.startDate, today),
      reuniones: publicSummaries(project.pafResumenes),
      anuncios: publicAnnouncements(project.pafAnuncios),
      hitosCompletados: hitosCompletados(project.pafHitos, project.pafEtapa || 'presencia'),
      etapa: project.pafEtapa || 'presencia',
      etapas: (['presencia', 'adquisicion', 'conversion'] as Etapa[]).filter((e) => e === 'presencia' || (project.pafEtapasContratadas || []).includes(e) || project.pafEtapa === e),
      // Solo lo que Juan escribe: el trabajo interno no se publica solo
      enMarcha: nosotrosDe(draft.nosotros),
      recorrido: project.serviceType === 'web' || (!project.serviceType && project.projectType === 'web') ? 'web' : 'presencia',
      reunionesHechas: (meetings as { projectId?: string; completed: boolean; proposed?: boolean }[]).filter((m) => m.projectId === project.id && m.completed && !m.proposed).length,
      reunionPorConfirmar: meetingPorConfirmar(meetings as Parameters<typeof meetingPorConfirmar>[0], project.id),
      reportes: project.pafReportes,
      privados: [project.pafDrive?.carpetaInterna, project.pafDrive?.ficha, ...privados],
    },
    now.toISOString()
  );
}

// ---------- "Terminé" del cliente ----------

/** paf_portal/{clienteId}/avisos/{id}: lo único que el cliente puede escribir */
export interface PafAviso {
  id: string;
  tareaId: string;
  email: string;
  creadoEn: string; // ISO
}

/**
 * Pasa a "enviada" las tareas habilitadas que el cliente avisó que terminó.
 * Solo cuenta avisos posteriores a la habilitación (si Juan la volvió a habilitar).
 * Devuelve null si no cambia nada.
 */
export function applyAvisos(tasks: PafTask[], avisos: PafAviso[]): PafTask[] | null {
  let changed = false;
  const next = tasks.map((t) => {
    if (t.estado !== 'habilitada') return t;
    const aviso = avisos
      .filter((a) => a.tareaId === t.id && (!t.habilitadaEn || a.creadoEn > t.habilitadaEn))
      .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))[0];
    if (!aviso) return t;
    changed = true;
    return { ...t, estado: 'enviada' as const, avisoEn: aviso.creadoEn };
  });
  return changed ? next : null;
}

export const APPROVAL_CHANNELS = ['WhatsApp', 'Reunión', 'Correo', 'Portal', 'Otro'] as const;

/** Aprobación de Juan: queda registrada con fecha y canal */
export function approveTask(task: PafTask, canal: string, now = new Date().toISOString()): PafTask {
  return { ...task, estado: 'aprobada', aprobacion: { fecha: now, canal: canal.trim() || 'Otro' } };
}

// ---------- Alta (CRM → Apps Script) ----------

export const PAF_PEDIDOS_COLLECTION = 'paf_pedidos_alta';

/**
 * paf_pedidos_alta/{autoId}. Lo crea el CRM con estado "pendiente" y ya con clienteId y
 * enlaceFormulario (Juan manda el link al instante). El Apps Script lo registra en la Sheet
 * con ESE ID y escribe en este mismo documento el estado y el bloque alta (carpetas, ficha,
 * respuesta). El script no toca ninguna otra colección.
 */
export interface PafPedidoAlta {
  id: string;
  projectId: string;
  estudio: string;
  contacto: string;
  email: string;
  zonaHoraria: string;
  prueba: boolean;
  estado: 'pendiente' | 'registrado' | 'error';
  clienteId?: string;
  enlaceFormulario?: string;
  error?: string;
  alta?: {
    estado?: string;
    carpetaInterna?: string;
    carpetaCompartida?: string;
    /** Subcarpeta Materiales de la compartida (si el script la devuelve) */
    materiales?: string;
    /** Partes y subcarpetas (script actualizado) */
    paraCompletar?: string;
    resultados?: string;
    proyectos?: string;
    equipo?: string;
    referencias?: string;
    registro?: string;
    excelClienteIdeal?: string;
    ficha?: string;
    fechaRespuesta?: string;
    error?: string;
  };
  creadoEn: string;
  actualizadoEn: string;
}

export function buildPedidoAlta(
  input: { projectId: string; clienteId: string; estudio: string; contacto: string; email: string; zonaHoraria: string; prueba: boolean },
  now = new Date().toISOString()
): { pedido: Omit<PafPedidoAlta, 'id'> } | { errors: string[] } {
  const errors: string[] = [];
  const email = input.email.trim().toLowerCase();
  if (!input.estudio.trim()) errors.push('Falta el nombre del estudio.');
  const clienteId = input.clienteId.trim().toUpperCase();
  if (clienteIdNumber(clienteId, input.prueba) === null) errors.push(input.prueba ? 'El ID de prueba tiene que ser PAF-PRUEBA-00N.' : 'El ID tiene que ser PAF-00N (ej. PAF-002).');
  if (!EMAIL_RE.test(email)) errors.push('El correo no es válido.');
  if (!input.zonaHoraria.trim()) errors.push('Falta la zona horaria.');
  if (errors.length) return { errors };
  return {
    pedido: {
      projectId: input.projectId,
      estudio: input.estudio.trim(),
      contacto: input.contacto.trim(),
      email,
      zonaHoraria: input.zonaHoraria.trim(),
      prueba: input.prueba,
      estado: 'pendiente',
      clienteId,
      enlaceFormulario: tallyLink(clienteId),
      creadoEn: now,
      actualizadoEn: now,
    },
  };
}

// ---------- ID y link de Tally (los da el CRM al instante) ----------

/** Formulario de arranque. El ID viaja en el campo oculto cliente_id. */
export const TALLY_FORM_URL = 'https://tally.so/r/2jXEVg';

export function tallyLink(clienteId: string): string {
  return `${TALLY_FORM_URL}?cliente_id=${encodeURIComponent(clienteId)}`;
}

export function formatClienteId(n: number, prueba: boolean): string {
  return `PAF-${prueba ? 'PRUEBA-' : ''}${String(n).padStart(3, '0')}`;
}

/** Número del ID si es del tipo pedido (real o prueba); null si no */
export function clienteIdNumber(id: string, prueba: boolean): number | null {
  const m = id.trim().toUpperCase().match(prueba ? /^PAF-PRUEBA-(\d{3,})$/ : /^PAF-(\d{3,})$/);
  return m ? Number(m[1]) : null;
}

/**
 * Próximo ID libre: uno más que el mayor usado (en la ficha, en pedidos o en el contador).
 * PAF-001 fue una prueba, así que el primer real es PAF-002. Un ID no se reutiliza nunca.
 */
export function suggestClienteId(usedIds: string[], prueba: boolean, lastCounter = 0): string {
  const max = Math.max(prueba ? 0 : 1, lastCounter, ...usedIds.map((id) => clienteIdNumber(id, prueba) ?? 0));
  return formatClienteId(max + 1, prueba);
}

/** Carpetas de Drive que Juan pega a mano mientras el script no las devuelve */
export interface PafDriveLinks {
  carpetaCompartida?: string;
  carpetaInterna?: string;
  ficha?: string;
  /** Partes de la carpeta compartida (las devuelve el script del alta) */
  materiales?: string;
  paraCompletar?: string;
  resultados?: string;
  excelClienteIdeal?: string;
  subcarpetas?: Partial<Record<MaterialKey, string>>;
}

// ---------- Aviso a Juan cuando el estudio toca "Terminé" (lo usa el servidor) ----------

/**
 * Verifica que el correo pueda avisar esa tarea en ese portal.
 * Devuelve el título de la tarea para el aviso, o el motivo del rechazo.
 */
export function checkTerminado(
  portal: Pick<PafPortalDoc, 'emailsAutorizados' | 'tareas'> & { tareasHabilitadas?: string[] } | null | undefined,
  email: string,
  tareaId: string
): { titulo: string } | { error: string } {
  if (!portal) return { error: 'Portal inexistente' };
  if (!portal.emailsAutorizados?.includes(email.trim().toLowerCase())) return { error: 'Correo no autorizado' };
  if (!(portal.tareasHabilitadas || []).includes(tareaId)) return { error: 'Tarea no habilitada' };
  const tarea = (portal.tareas || []).find((t) => t.id === tareaId);
  return tarea ? { titulo: tarea.titulo } : { error: 'Tarea inexistente' };
}

/** Estudios con tareas que avisaron "Terminé" y esperan la aprobación de Juan */
export function pafToReview<P extends { id: string; clientName: string; archived?: boolean; pafTareas?: PafTask[] }>(projects: P[]) {
  return projects
    .filter((p) => !p.archived)
    .map((p) => ({ project: p, count: (p.pafTareas || []).filter((t) => t.estado === 'enviada').length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.project.clientName.localeCompare(b.project.clientName));
}

// ---------- Panel de Juan (fase 2) ----------

/** Clave comparable de un link: el ID del archivo/carpeta de Drive, o el link sin barra final */
export function driveKey(url: string): string {
  const m = url.match(/\/folders\/([\w-]{10,})|\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/);
  return m ? (m[1] || m[2] || m[3]) : url.trim().replace(/\/+$/, '').toLowerCase();
}

/** ¿El link es la carpeta interna o la ficha? (eso nunca va al portal) */
export function isPrivateUrl(url: string, privados: (string | undefined)[] = []): boolean {
  const key = driveKey(url);
  return privados.some((p) => p && driveKey(p) === key);
}

/** Lo que el estudio ve hoy difiere de lo que Juan tiene cargado (etapa, foco, correos, enlaces) */
export function portalDirty(draft: PafPortalDraft, published: Pick<PafPortalDoc, 'emailsAutorizados' | 'hitoVisible' | 'resumenVisible' | 'enlaces' | 'accesos' | 'logo' | 'marca' | 'linkReunion' | 'mostrarAvance'> | null | undefined, privados: (string | undefined)[] = []): boolean {
  if (!published) return false;
  return (
    (safeLogo(draft.logo) ?? null) !== (published.logo ?? null) ||
    (safeColor(draft.marca) ?? null) !== (published.marca ?? null) ||
    (draft.linkReunion ? safeHttpsUrl(normalizeLinkInput(draft.linkReunion)) : null) !== (published.linkReunion ?? null) ||
    (draft.mostrarAvance !== false) !== (published.mostrarAvance !== false) ||
    JSON.stringify(publishableAccesos(draftAccesos(draft), privados)) !== JSON.stringify((published.accesos ?? accessesFromEnlaces(published.enlaces || {})).map(({ nombre, url }) => ({ nombre, url }))) ||
    normalizeEmails(draft.emails).join(',') !== [...(published.emailsAutorizados || [])].join(',') ||
    Math.min(PRESENCIA_HITOS.length, Math.max(1, Math.round(draft.hito || 1))) !== published.hitoVisible ||
    draft.resumen.trim().slice(0, 2000) !== (published.resumenVisible || '')
  );
}

// ---------- Portal libre: accesos directos y anuncios ----------

/** Los 5 enlaces de antes como accesos directos (mismo nombre y orden) */
export function accessesFromEnlaces(enlaces: Partial<Record<PafPortalLinkKey, string>>): PafAccess[] {
  return PAF_PORTAL_LINK_KEYS.filter((k) => enlaces[k]?.trim()).map((k) => ({ id: `enlace-${k}`, nombre: PAF_PORTAL_LINK_LABEL[k], url: enlaces[k]!.trim() }));
}

/** Accesos del borrador: los libres si ya se editaron; si no, los 5 enlaces de antes (no se pierden) */
export function draftAccesos(draft: Pick<PafPortalDraft, 'accesos' | 'enlaces'>): PafAccess[] {
  return draft.accesos ?? accessesFromEnlaces(draft.enlaces || {});
}

/** Lo que ve el estudio: solo publicados, fijados arriba y después los más nuevos; links solo https */
export function publicAnnouncements(items: PafAnnouncement[] = []): PafPortalAnnouncement[] {
  return items
    .filter((a) => a.publicado && a.texto.trim())
    .sort((a, b) => Number(!!b.fijado) - Number(!!a.fijado) || b.creadoEn.localeCompare(a.creadoEn))
    .slice(0, 20)
    .map((a) => {
      const link = a.link ? safeHttpsUrl(a.link) : null;
      return {
        id: a.id,
        texto: a.texto.trim().slice(0, 1000),
        fecha: a.creadoEn.slice(0, 10),
        ...(a.titulo?.trim() ? { titulo: a.titulo.trim().slice(0, 120) } : {}),
        ...(link ? { link } : {}),
        ...(a.fijado ? { fijado: true } : {}),
      };
    });
}

/** Canal que se propone al aprobar: el último que usó Juan, o Portal */
export function suggestedChannel(tasks: PafTask[]): string {
  const last = tasks
    .filter((t) => t.aprobacion)
    .sort((a, b) => b.aprobacion!.fecha.localeCompare(a.aprobacion!.fecha))[0];
  return last?.aprobacion?.canal || 'Portal';
}

/** Volver a habilitar con un motivo corto que ve el estudio. Borra el aviso y la aprobación anteriores. */
export function reopenTask(task: PafTask, motivo: string, now = new Date().toISOString()): PafTask {
  const { avisoEn: _a, aprobacion: _b, ...rest } = task;
  return { ...rest, estado: 'habilitada', habilitadaEn: now, motivo: motivo.trim().slice(0, 140) };
}

/** Objetivos del panel del estudio → lo que ve en "Esta semana" (sin IDs internos) */
export function portalGoals(goals: { text: string; done: boolean; quien?: 'cero' | 'estudio' }[] = []): PafPortalGoal[] {
  return goals.filter((g) => g.text.trim()).map((g) => ({ texto: g.text.trim(), hecho: !!g.done, quien: g.quien === 'cero' ? 'cero' : 'estudio' }));
}

/** Tarea habilitada con fecha pasada que el estudio todavía no avisó */
export function isOverdue(t: Pick<PafPortalTask, 'estado' | 'fecha'>, today: string): boolean {
  return t.estado === 'habilitada' && !!t.fecha && t.fecha < today;
}

// ---------- Tablero "PAF hoy" (fase 4) ----------

export interface PafTodayRow {
  id: string;
  estudio: string;
  paraRevisar: number;
  proximaReunion: { fecha: string; hora?: string } | null;
  etapa: number | null; // la que ve el estudio (null si no tiene portal cargado)
  diasSinNovedades: number | null; // desde el último movimiento del estudio o de Juan
}

/** Una fila por estudio: lo urgente arriba (para revisar, después el más quieto) */
export function pafTodayRows(
  projects: { id: string; clientName: string; pafTareas?: PafTask[]; pafPortal?: PafPortalDraft; lastContactDate?: string }[],
  meetings: Parameters<typeof nextMeeting>[0],
  today: string
): PafTodayRow[] {
  const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');
  return projects.map((p) => {
    const tasks = p.pafTareas || [];
    const done = meetings.filter((m) => m.projectId === p.id && (m.completed || m.date < today)).map((m) => m.date);
    const last = [
      ...tasks.map((t) => day(t.avisoEn)),
      ...tasks.map((t) => day(t.aprobacion?.fecha)),
      ...tasks.map((t) => day(t.habilitadaEn)),
      day(p.lastContactDate),
      ...done,
    ].filter(Boolean).sort().pop();
    return {
      id: p.id,
      estudio: p.clientName,
      paraRevisar: tasks.filter((t) => t.estado === 'enviada').length,
      proximaReunion: nextMeeting(meetings, p.id, today),
      etapa: p.pafPortal ? Math.min(PRESENCIA_HITOS.length, Math.max(1, p.pafPortal.hito || 1)) : null,
      diasSinNovedades: last ? Math.max(0, Math.round((Date.parse(today) - Date.parse(last)) / 86400000)) : null,
    };
  }).sort((a, b) => b.paraRevisar - a.paraRevisar || (b.diasSinNovedades ?? -1) - (a.diasSinNovedades ?? -1) || a.estudio.localeCompare(b.estudio));
}

// ---------- Resumen de reunión (fase 4) ----------

/** Lo que Juan anota después de una reunión (en la ficha) */
export interface PafMeetingSummary {
  id: string;
  fecha: string; // YYYY-MM-DD
  acuerdos: string;
  proximosPasos: string;
  publicado: boolean;
}

/** Lo que ve el estudio: solo los publicados, del más nuevo al más viejo */
export function publicSummaries(items: PafMeetingSummary[] = []): { fecha: string; acuerdos: string; proximosPasos: string }[] {
  return items
    .filter((s) => s.publicado && (s.acuerdos.trim() || s.proximosPasos.trim()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 12)
    .map((s) => ({ fecha: s.fecha, acuerdos: s.acuerdos.trim().slice(0, 2000), proximosPasos: s.proximosPasos.trim().slice(0, 2000) }));
}

// ---------- Plantillas de tareas por etapa (fase 4) ----------

export interface PafStageTemplate {
  /** Reunión que conviene agendar al entrar en la etapa */
  reunion?: string;
  tareas: { titulo: string; detalle?: string; pideArchivos?: boolean }[];
}

/**
 * Tareas sugeridas para el estudio en cada etapa de Presencia. Son un punto de partida:
 * Juan elige cuáles agregar y las puede editar o borrar después.
 */
export const PAF_STAGE_TEMPLATES: Record<number, PafStageTemplate> = {
  1: {
    reunion: 'Reunión de arranque',
    tareas: [
      { titulo: 'Completar el formulario de arranque', detalle: 'El link de Tally que te mandamos. Con eso preparamos tu carpeta.' },
      { titulo: 'Compartir accesos a redes y web', detalle: 'Usuario o acceso de colaborador de Instagram, Google y tu sitio, si tenés.' },
      { titulo: 'Subir logo y fotos de obras', detalle: 'Las de mejor calidad que tengas, sin editar.', pideArchivos: true },
    ],
  },
  2: {
    reunion: 'Reunión de foco',
    tareas: [
      { titulo: 'Elegir 3 proyectos que te representen', detalle: 'Los que te gustaría hacer más seguido.' },
      { titulo: 'Contarnos tu cliente ideal', detalle: 'Quién es, qué busca y por qué te elegiría.' },
    ],
  },
  3: {
    reunion: 'Reunión de mensaje',
    tareas: [
      { titulo: 'Revisar la propuesta de mensaje', detalle: 'Leela con calma y marcá lo que no te suene a vos.' },
      { titulo: 'Aprobar la bio y los textos clave' },
    ],
  },
  4: {
    tareas: [
      { titulo: 'Subir fotos para el perfil', detalle: 'Retrato y equipo, si querés que aparezcan.', pideArchivos: true },
      { titulo: 'Revisar el perfil actualizado' },
      { titulo: 'Revisar la web', detalle: 'Navegala desde el celular y contanos qué cambiarías.' },
    ],
  },
  5: {
    reunion: 'Reunión de cierre',
    tareas: [
      { titulo: 'Completar la encuesta de cierre' },
    ],
  },
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Lo que falta de la plantilla de una etapa (no repite tareas que ya existen, por título) */
export function missingTemplateTasks(hito: number, tasks: PafTask[] = []): PafStageTemplate['tareas'] {
  return (PAF_STAGE_TEMPLATES[hito]?.tareas || []).filter((t) => !tasks.some((x) => sameTitle(x.titulo, t.titulo)));
}

// ---------- Contenido para aprobar (fase 4) ----------

export type PafPieceState = 'para_aprobar' | 'aprobada' | 'cambios' | 'publicada';

/** Pieza tal como la ve el estudio (sale de las piezas del panel del estudio) */
export interface PafPortalPiece {
  id: string;
  fecha: string;
  soporte: 'carrusel' | 'reel' | 'estatico';
  titulo: string;
  caption?: string;
  /** Solo imágenes públicas ("pub:…" o https); nunca archivos privados */
  slides: { display: string; thumb: string }[];
  estado: PafPieceState;
  comentario?: string;
}

const publicRef = (ref: string) => ref.startsWith('pub:') || !!safeHttpsUrl(ref);

export function portalPieces(pieces: { id: string; date: string; support: PafPortalPiece['soporte']; title: string; caption?: string; slides: { display: string; thumb: string }[]; state: PafPieceState; clientComment?: string }[] = []): PafPortalPiece[] {
  return [...pieces]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      id: p.id,
      fecha: p.date,
      soporte: p.support,
      titulo: p.title,
      ...(p.caption ? { caption: p.caption } : {}),
      slides: p.slides.filter((s) => publicRef(s.display) && publicRef(s.thumb)).map((s) => ({ display: s.display, thumb: s.thumb })),
      estado: p.state,
      ...(p.clientComment ? { comentario: p.clientComment } : {}),
    }));
}

/** ¿Puede este correo aprobar o pedir cambios en esta pieza? (lo usa el servidor) */
export function checkPieza(
  portal: (Pick<PafPortalDoc, 'emailsAutorizados'> & { piezas?: PafPortalPiece[] }) | null | undefined,
  email: string,
  pieceId: string
): { titulo: string } | { error: string } {
  if (!portal) return { error: 'Portal inexistente' };
  if (!portal.emailsAutorizados?.includes(email.trim().toLowerCase())) return { error: 'Correo no autorizado' };
  const pieza = (portal.piezas || []).find((p) => p.id === pieceId);
  if (!pieza) return { error: 'Pieza inexistente' };
  if (pieza.estado !== 'para_aprobar' && pieza.estado !== 'cambios') return { error: 'Esta pieza ya no está para revisar' };
  return { titulo: pieza.titulo };
}

/** Próximo WEB-### libre para el portal de un cliente Web */
export function suggestWebClienteId(usedIds: string[]): string {
  const max = Math.max(0, ...usedIds.map((id) => Number(id.trim().toUpperCase().match(/^WEB-(\d{3,})$/)?.[1] ?? 0)));
  return `WEB-${String(max + 1).padStart(3, '0')}`;
}

/** Qué le falta a un acceso para publicarse (se muestra al lado de la fila) */
export function accessIssue(a: { nombre: string; url: string }, privados: (string | undefined)[] = []): string | null {
  if (!a.url.trim()) return a.nombre.trim() ? 'Falta pegar el link' : null;
  const url = safeHttpsUrl(normalizeLinkInput(a.url));
  if (!url) return 'Ese link no se puede abrir: copialo de nuevo desde el navegador';
  if (isPrivateUrl(url, privados)) return 'Es la carpeta interna o la ficha: no se publica';
  return null;
}

export type AccessIconKey = 'drive' | 'doc' | 'sheet' | 'calendar' | 'web' | 'instagram' | 'video' | 'design' | 'chart' | 'image' | 'chat' | 'meet' | 'link';

/** El sitio del link, para mostrar debajo del nombre (drive.google.com, asana.com…) */
export function accessHost(url: string): string {
  try { return new URL(url.trim()).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Ícono según lo que es el acceso: mira el sitio del link y el nombre */
export function accessIcon(nombre: string, url = ''): AccessIconKey {
  const n = ` ${nombre.toLowerCase()} `;
  const host = accessHost(url);
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  const at = (...h: string[]) => h.some((x) => host.includes(x));
  if (at('docs.google.com') && url.includes('/spreadsheets/')) return 'sheet';
  if (at('docs.google.com') && url.includes('/presentation/')) return 'doc';
  if (at('instagram.com') || has('instagram')) return 'instagram';
  if (at('youtube.com', 'youtu.be', 'vimeo.com') || has('video', 'reel', 'grabación', 'grabacion')) return 'video';
  if (at('meet.google', 'zoom.us') || has('reunión', 'reunion', ' meet', 'zoom')) return 'meet';
  if (at('figma.com', 'canva.com') || has('diseño', 'diseno', 'marca', 'logo', 'identidad')) return 'design';
  if (at('lookerstudio', 'analytics.google', 'datastudio') || has('resultado', 'métrica', 'metrica', 'reporte', 'estadística', 'estadistica', 'analytics')) return 'chart';
  if (at('asana.com', 'calendar.google', 'trello.com', 'notion.so') || has('calendario', 'contenido', 'agenda', 'cronograma', 'planificación', 'planificacion')) return 'calendar';
  if (at('wa.me', 'whatsapp') || has('whatsapp', ' chat')) return 'chat';
  if (has('planilla', 'excel', 'sheet')) return 'sheet';
  if (at('docs.google.com') || has('documento', ' doc ', 'pdf', 'brief', 'propuesta', 'contrato', 'guía', 'guia')) return 'doc';
  if (has('foto', 'imagen', 'material', 'galería', 'galeria')) return 'image';
  if (at('drive.google.com', 'dropbox.com') || has('carpeta', 'drive', 'archivos')) return 'drive';
  if (has(' web', 'sitio', 'página', 'pagina', 'landing', 'tienda')) return 'web';
  return host ? 'web' : 'link';
}

/** "drive.google.com/…" o "http://…" → "https://…" (lo que se pega a mano suele venir sin https) */
export function normalizeLinkInput(raw: string): string {
  const v = raw.trim();
  if (/^http:\/\//i.test(v)) return `https://${v.slice(7)}`;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[\w-]+(\.[\w-]+)+(\/|$|\?)/.test(v)) return `https://${v}`;
  return v;
}

const ICON_NAME: Record<AccessIconKey, string> = {
  drive: 'Carpeta de Drive', doc: 'Documento', sheet: 'Planilla', calendar: 'Calendario de contenido', web: '', instagram: 'Instagram',
  video: 'Video', design: 'Diseño', chart: 'Resultados', image: 'Imágenes', chat: 'WhatsApp', meet: 'Reunión', link: 'Enlace',
};

/** Nombre para un acceso que se cargó solo con el link */
export function defaultAccessName(url: string): string {
  return ICON_NAME[accessIcon('', url)] || accessHost(url) || 'Enlace';
}

/** Lo que de verdad se publica: link completado, nombre por defecto y nada privado */
export function publishableAccesos(list: { nombre: string; url: string }[], privados: (string | undefined)[] = []): { nombre: string; url: string }[] {
  const out: { nombre: string; url: string }[] = [];
  for (const a of list) {
    const url = a.url.trim() ? safeHttpsUrl(normalizeLinkInput(a.url)) : null;
    if (!url || isPrivateUrl(url, privados)) continue;
    out.push({ nombre: a.nombre.trim().slice(0, 60) || defaultAccessName(url), url });
  }
  return out;
}

const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
/** Logo chico y en formato de imagen; si no, no se publica */
export function safeLogo(v?: string | null): string | null {
  return v && v.length <= 200_000 && LOGO_RE.test(v) ? v : null;
}
export function safeColor(v?: string | null): string | null {
  return v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

/** Link para sumar la reunión a Google Calendar (lo abre el cliente) */
export function calendarLink(r: { fecha: string; hora?: string }, title: string, link?: string | null): string {
  const d = r.fecha.replace(/-/g, '');
  let dates = `${d}/${d}`;
  if (r.hora) {
    const [h, m] = r.hora.split(':').map(Number);
    const start = `${d}T${String(h).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`;
    const end = `${d}T${String(Math.min(23, h + 1)).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`;
    dates = `${start}/${end}`;
  } else {
    const next = new Date(`${r.fecha}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    dates = `${d}/${next.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates, ctz: 'America/Argentina/Buenos_Aires', ...(link ? { details: `Link: ${link}`, location: link } : {}) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Claves de lo que hay en el portal, para marcar "Nuevo" lo que no vio la última vez */
export function portalItemKeys(p: Pick<PafPortalDoc, 'anuncios' | 'tareas' | 'entregas' | 'accesos' | 'enlaces' | 'reuniones'>): string[] {
  return [
    ...(p.anuncios || []).map((a) => `a:${a.id}`),
    ...(p.tareas || []).filter((t) => t.estado === 'habilitada').map((t) => `t:${t.id}:${t.habilitadaEn || ''}`),
    ...(p.entregas || []).map((e) => `e:${e.id}`),
    ...(p.accesos ?? accessesFromEnlaces(p.enlaces || {})).map((a) => `l:${a.url}`),
    ...(p.reuniones || []).map((r) => `r:${r.fecha}`),
  ];
}

/**
 * Accesos que se suman solos cuando el script devuelve las carpetas del alta:
 * "Tu carpeta" y "Materiales", sin repetir los que ya están (por carpeta de Drive).
 */
export function accesosDelAlta(actuales: PafAccess[], alta: { carpetaCompartida?: string; materiales?: string } | undefined, newId: () => string): PafAccess[] | null {
  const nuevos = [
    { nombre: 'Tu carpeta', url: alta?.carpetaCompartida },
    { nombre: 'Materiales', url: alta?.materiales },
  ].filter((a): a is { nombre: string; url: string } => !!a.url && !!safeHttpsUrl(a.url))
    .filter((a) => !actuales.some((x) => x.url && driveKey(x.url) === driveKey(a.url)));
  return nuevos.length ? [...actuales, ...nuevos.map((a) => ({ id: newId(), nombre: a.nombre, url: safeHttpsUrl(a.url)! }))] : null;
}

import type { Etapa } from './presencia';
import { ETAPA_HITOS, temaPorId } from './presencia';
import { cartaDe, esCartaSuelta, publicPasos } from './pasos';
/** Solo se publica la carta si junta cosas: lo suelto ya se arma solo en el portal */
const pasoDe = (x: Parameters<typeof cartaDe>[0], tipo: 't' | 'e') => { const id = cartaDe(x, tipo).id; return esCartaSuelta(id) ? {} : { paso: id }; };

/**
 * "Nos toca a nosotros": lo que .CERO o la CM tienen entre manos, en palabras para el cliente.
 * Sale de las tareas que hacen ellos y de las entregas que se están preparando (nada privado).
 */
/** "Mientras tanto, nosotros" escrito por Juan: una línea por cosa, hasta 3 */
export function nosotrosDe(texto?: string): { texto: string; quien: 'cero' | 'cm' }[] {
  return (texto || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 3).map((t) => ({ texto: t, quien: 'cero' as const }));
}

export function enMarchaDe(project: { pafTareas?: PafTask[]; pafEntregas?: PafDelivery[] }): { texto: string; quien: 'cero' | 'cm' }[] {
  const tareas = (project.pafTareas || []).filter((t) => t.estado === 'habilitada' && t.responsable && t.responsable !== 'estudio')
    .map((t) => ({ texto: t.titulo, quien: t.responsable as 'cero' | 'cm' }));
  const entregas = (project.pafEntregas || []).filter((e) => !e.publicada && e.tema)
    .map((e) => ({ texto: `Preparando: ${e.titulo}`, quien: (temaPorId(e.tema!)?.servicio === 'contenido' ? 'cm' : 'cero') as 'cero' | 'cm' }));
  return [...entregas, ...tareas];
}
