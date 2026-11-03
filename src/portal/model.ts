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

/** PAF-002, PAF-PRUEBA-001… Un ID no se reutiliza nunca. */
export const CLIENTE_ID_RE = /^PAF-(PRUEBA-)?\d{3,}$/;

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
  publishedAt?: string;
}

/**
 * Tarea del estudio (privada, en el proyecto). El cliente la ve solo cuando Juan la habilita.
 * "Terminé" del cliente la pasa a "enviada"; la aprobación la confirma Juan con fecha y canal.
 */
export type PafTaskState = 'borrador' | 'habilitada' | 'enviada' | 'aprobada';
export const PAF_TASK_STATE_LABEL: Record<PafTaskState, string> = {
  borrador: 'Sin habilitar',
  habilitada: 'Habilitada',
  enviada: 'Avisó que terminó',
  aprobada: 'Aprobada',
};
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
}

/** Entrega de Juan al estudio: archivo en Drive, se publica cuando él decide */
export interface PafDelivery {
  id: string;
  titulo: string;
  fecha?: string;
  enlace?: string;
  publicada: boolean;
}

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
  proximaReunion: { fecha: string; hora?: string } | null;
  /** Semana del programa (sale de la fecha de inicio) */
  semana?: { actual: number; total: number } | null;
  actualizadoEn: string;
  /** Se publican aparte (ver PORTAL_SEPARATE_FIELDS): objetivos de la semana y WhatsApp de Juan */
  objetivos?: PafPortalGoal[];
  contacto?: { whatsapp?: string };
}

/** Campos que no pisa la publicación general (vienen del panel del estudio y de la configuración de Juan) */
export const PORTAL_SEPARATE_FIELDS = ['objetivos', 'contacto'] as const;

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
  input: { clienteId?: string; estudio: string; draft: PafPortalDraft; tareas?: PafPortalTask[]; entregas?: PafPortalDelivery[]; proximaReunion?: PafPortalDoc['proximaReunion']; semana?: PafPortalDoc['semana']; privados?: (string | undefined)[] },
  now = new Date().toISOString()
): { doc: PafPortalDoc } | { errors: string[] } {
  const errors: string[] = [];
  const clienteId = (input.clienteId || '').trim().toUpperCase();
  if (!CLIENTE_ID_RE.test(clienteId)) errors.push('Falta el ID del cliente (ej. PAF-002 o PAF-PRUEBA-001).');

  const emails = normalizeEmails(input.draft.emails);
  if (!emails.length) errors.push('Agregá al menos un correo autorizado.');
  const wrong = emails.filter((e) => !EMAIL_RE.test(e));
  if (wrong.length) errors.push(`Correo inválido: ${wrong.join(', ')}`);

  const enlaces: PafPortalDoc['enlaces'] = {};
  for (const key of PAF_PORTAL_LINK_KEYS) {
    const raw = input.draft.enlaces[key]?.trim();
    if (!raw) continue;
    const url = safeHttpsUrl(raw);
    if (url && isPrivateUrl(url, input.privados)) errors.push(`"${PAF_PORTAL_LINK_LABEL[key]}" es la carpeta interna o la ficha: eso no lo puede ver el estudio.`);
    else if (url) enlaces[key] = url;
    else errors.push(`El enlace "${PAF_PORTAL_LINK_LABEL[key]}" tiene que empezar con https://`);
  }

  if (errors.length) return { errors };
  const hito = Math.min(PRESENCIA_HITOS.length, Math.max(1, Math.round(input.draft.hito || 1)));
  return {
    doc: {
      clienteId,
      estudio: input.estudio.trim(),
      emailsAutorizados: emails,
      hitoVisible: hito,
      resumenVisible: input.draft.resumen.trim().slice(0, 2000),
      enlaces,
      tareas: (input.tareas || []).map(({ id, titulo, detalle, fecha, estado, aprobadaEl, habilitadaEn, motivo, pideArchivos }) => ({ id, titulo, estado, ...(detalle ? { detalle } : {}), ...(fecha ? { fecha } : {}), ...(aprobadaEl ? { aprobadaEl } : {}), ...(habilitadaEn ? { habilitadaEn } : {}), ...(motivo && estado === 'habilitada' ? { motivo } : {}), ...(pideArchivos ? { pideArchivos: true } : {}) })),
      tareasHabilitadas: (input.tareas || []).filter((t) => t.estado === 'habilitada').map((t) => t.id),
      entregas: (input.entregas || []).map(({ id, titulo, fecha, enlace }) => ({ id, titulo, ...(fecha ? { fecha } : {}), ...(enlace && safeHttpsUrl(enlace) ? { enlace: safeHttpsUrl(enlace)! } : {}) })),
      proximaReunion: input.proximaReunion || null,
      semana: input.semana || null,
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
      ...(t.detalle ? { detalle: t.detalle } : {}),
      ...(t.fecha ? { fecha: t.fecha } : {}),
      ...(t.habilitadaEn ? { habilitadaEn: t.habilitadaEn } : {}),
      ...(t.motivo && t.estado === 'habilitada' ? { motivo: t.motivo } : {}),
      ...(t.pideArchivos ? { pideArchivos: true } : {}),
      ...(t.estado === 'aprobada' && t.aprobacion ? { aprobadaEl: t.aprobacion.fecha.slice(0, 10) } : {}),
    }));
}

export function publicDeliveries(items: PafDelivery[] = []): PafPortalDelivery[] {
  return items.filter((d) => d.publicada).map(({ id, titulo, fecha, enlace }) => ({ id, titulo, fecha, enlace }));
}

/** Próxima reunión confirmada del proyecto (sin las propuestas sin hora) */
export function nextMeeting(
  meetings: { projectId?: string; date: string; time?: string; completed: boolean; proposed?: boolean }[],
  projectId: string,
  today: string
): PafPortalDoc['proximaReunion'] {
  const next = meetings
    .filter((m) => m.projectId === projectId && !m.completed && !m.proposed && m.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  return next ? { fecha: next.date, ...(next.time ? { hora: next.time } : {}) } : null;
}

export function portalFromProject(
  project: { id: string; clientName: string; pafClienteId?: string; pafPortal?: PafPortalDraft; pafTareas?: PafTask[]; pafEntregas?: PafDelivery[]; pafDrive?: PafDriveLinks; pafStartDate?: string; startDate?: string },
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
      proximaReunion: nextMeeting(meetings, project.id, today),
      semana: programWeek(project.pafStartDate || project.startDate, today),
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
export function portalDirty(draft: PafPortalDraft, published: Pick<PafPortalDoc, 'emailsAutorizados' | 'hitoVisible' | 'resumenVisible' | 'enlaces'> | null | undefined): boolean {
  if (!published) return false;
  const links = (e: PafPortalDraft['enlaces']) =>
    JSON.stringify(PAF_PORTAL_LINK_KEYS.map((k) => (e[k]?.trim() ? safeHttpsUrl(e[k]!) || e[k]!.trim() : '')));
  return (
    normalizeEmails(draft.emails).join(',') !== [...(published.emailsAutorizados || [])].join(',') ||
    Math.min(PRESENCIA_HITOS.length, Math.max(1, Math.round(draft.hito || 1))) !== published.hitoVisible ||
    draft.resumen.trim().slice(0, 2000) !== (published.resumenVisible || '') ||
    links(draft.enlaces) !== links(published.enlaces || {})
  );
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
