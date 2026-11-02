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
  asana: 'Contenido en Asana',
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
  entregas: PafPortalDelivery[];
  proximaReunion: { fecha: string; hora?: string } | null;
  actualizadoEn: string;
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
  input: { clienteId?: string; estudio: string; draft: PafPortalDraft; tareas?: PafPortalTask[]; entregas?: PafPortalDelivery[]; proximaReunion?: PafPortalDoc['proximaReunion'] },
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
    if (url) enlaces[key] = url;
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
      tareas: (input.tareas || []).map(({ id, titulo, detalle, fecha, estado, aprobadaEl, habilitadaEn }) => ({ id, titulo, estado, ...(detalle ? { detalle } : {}), ...(fecha ? { fecha } : {}), ...(aprobadaEl ? { aprobadaEl } : {}), ...(habilitadaEn ? { habilitadaEn } : {}) })),
      entregas: (input.entregas || []).map(({ id, titulo, fecha, enlace }) => ({ id, titulo, ...(fecha ? { fecha } : {}), ...(enlace && safeHttpsUrl(enlace) ? { enlace: safeHttpsUrl(enlace)! } : {}) })),
      proximaReunion: input.proximaReunion || null,
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
  project: { id: string; clientName: string; pafClienteId?: string; pafPortal?: PafPortalDraft; pafTareas?: PafTask[]; pafEntregas?: PafDelivery[] },
  meetings: Parameters<typeof nextMeeting>[0],
  draft: PafPortalDraft = project.pafPortal || emptyPortalDraft(),
  clienteId = project.pafClienteId,
  now = new Date()
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
