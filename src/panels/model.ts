/**
 * PANEL DEL CLIENTE
 * Un link privado por cliente (como el portal del alumno): objetivos de la semana,
 * tareas que le dejás y contenido para aprobar (carruseles, reels, estáticos).
 *
 * - Vos editás client_panels/{id} (privado).
 * - El cliente lee una copia en student_portals/panel_{token} (lectura por link, sin listar).
 * - Lo que hace el cliente (marcar hecha, aprobar, pedir cambio) lo registra el servidor
 *   en los dos lados, con las funciones de acá abajo.
 * Lógica pura: la usan la app, el servidor y los tests.
 */

export type PanelSupport = 'carrusel' | 'reel' | 'estatico';
export type PanelPieceState = 'para_aprobar' | 'aprobada' | 'cambios' | 'publicada';

export interface PanelGoal {
  id: string;
  text: string;
  done: boolean;
}

export interface PanelTask {
  id: string;
  title: string;
  date?: string; // YYYY-MM-DD
  detail?: string;
  done: boolean;
  doneAt?: string;
  /** Lo que escribió el cliente al marcarla */
  clientNote?: string;
}

export interface PanelSlide {
  /** Referencia "pub:<id>" (copia pública) */
  display: string;
  thumb: string;
}

export interface PanelPiece {
  id: string;
  date: string;
  support: PanelSupport;
  title: string;
  caption?: string;
  slides: PanelSlide[];
  state: PanelPieceState;
  clientComment?: string;
  reviewedAt?: string;
}

export interface PanelWeek {
  weekStart: string;
  goals: PanelGoal[];
}

export interface ClientPanel {
  id: string;
  token: string;
  active: boolean;
  clientName: string;
  projectId?: string;
  /** Alumno PAF: usa el mismo link que su portal (/alumno/{token}) y se ve ahí adentro */
  portal?: boolean;
  phone?: string;
  /** Mensaje corto arriba de todo ("Esta semana arrancamos con…") */
  note?: string;
  weekStart: string;
  goals: PanelGoal[];
  pastWeeks?: PanelWeek[];
  tasks: PanelTask[];
  pieces: PanelPiece[];
  /** Última novedad del cliente, para mostrarte el aviso */
  lastClientAction?: { at: string; text: string };
  createdAt: string;
  updatedAt?: string;
}

/** Lo que ve el cliente: sin ids internos ni teléfono */
export interface PanelSnapshot {
  kind: 'panel';
  token: string;
  clientName: string;
  note?: string;
  weekStart: string;
  goals: PanelGoal[];
  pastWeeks: PanelWeek[];
  tasks: PanelTask[];
  pieces: PanelPiece[];
  updatedAt: string;
}

export const PANEL_STATE_LABEL: Record<PanelPieceState, string> = {
  para_aprobar: 'Para aprobar',
  aprobada: 'Aprobada',
  cambios: 'Pediste cambios',
  publicada: 'Publicada',
};

/** Para vos (en el CRM) el mismo estado, dicho desde tu lado */
export const PANEL_STATE_LABEL_OWNER: Record<PanelPieceState, string> = {
  para_aprobar: 'Esperando aprobación',
  aprobada: 'Aprobada',
  cambios: 'Pidió cambios',
  publicada: 'Publicada',
};

export const TOKEN_RE = /^[a-f0-9]{24,64}$/;
export const panelDocId = (token: string) => `panel_${token}`;

export function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const newItemId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function snapshotOf(p: ClientPanel, now = new Date().toISOString()): PanelSnapshot {
  return {
    kind: 'panel',
    token: p.token,
    clientName: p.clientName,
    note: p.note || undefined,
    weekStart: p.weekStart,
    goals: p.goals,
    pastWeeks: (p.pastWeeks || []).slice(0, 8),
    tasks: [...p.tasks].sort(byTask),
    pieces: [...p.pieces].sort((a, b) => a.date.localeCompare(b.date)),
    updatedAt: now,
  };
}

/** Pendientes primero (por fecha), después las hechas */
export function byTask(a: PanelTask, b: PanelTask): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return (a.date || '9999').localeCompare(b.date || '9999');
}

// ---------- Acciones del cliente (las aplica el servidor) ----------

export type ClientAction =
  | { type: 'tarea'; taskId: string; done: boolean; note?: string }
  | { type: 'pieza'; pieceId: string; decision: 'aprobar' | 'cambios'; comment?: string };

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);

/** Valida lo que manda el link público; null si no es válido */
export function parseClientAction(body: any): ClientAction | null {
  if (body?.type === 'tarea' && typeof body.taskId === 'string') {
    return { type: 'tarea', taskId: clean(body.taskId, 40), done: !!body.done, note: clean(body.note, 500) || undefined };
  }
  if (body?.type === 'pieza' && typeof body.pieceId === 'string' && (body.decision === 'aprobar' || body.decision === 'cambios')) {
    const comment = clean(body.comment, 1000) || undefined;
    if (body.decision === 'cambios' && !comment) return null;
    return { type: 'pieza', pieceId: clean(body.pieceId, 80), decision: body.decision, comment };
  }
  return null;
}

/** Aplica la acción al panel. Devuelve el panel nuevo y el aviso para vos, o un error */
export function applyClientAction(
  p: ClientPanel,
  a: ClientAction,
  now = new Date().toISOString()
): { panel: ClientPanel; notice: { title: string; body: string } } | { error: string } {
  if (a.type === 'tarea') {
    const t = p.tasks.find((x) => x.id === a.taskId);
    if (!t) return { error: 'No encontramos esa tarea' };
    const tasks = p.tasks.map((x) =>
      x.id === a.taskId ? { ...x, done: a.done, doneAt: a.done ? now : undefined, clientNote: a.note ?? (a.done ? x.clientNote : undefined) } : x
    );
    const text = a.done ? `completó "${t.title}"` : `desmarcó "${t.title}"`;
    return {
      panel: { ...p, tasks, lastClientAction: { at: now, text }, updatedAt: now },
      notice: { title: `✅ ${p.clientName} ${text}`, body: a.note ? `Dejó una nota: ${a.note}` : 'Desde su panel.' },
    };
  }
  const piece = p.pieces.find((x) => x.id === a.pieceId);
  if (!piece) return { error: 'No encontramos esa pieza' };
  const state: PanelPieceState = a.decision === 'aprobar' ? 'aprobada' : 'cambios';
  const pieces = p.pieces.map((x) => (x.id === a.pieceId ? { ...x, state, clientComment: a.comment, reviewedAt: now } : x));
  const text = a.decision === 'aprobar' ? `aprobó "${piece.title}"` : `pidió cambios en "${piece.title}"`;
  return {
    panel: { ...p, pieces, lastClientAction: { at: now, text }, updatedAt: now },
    notice: {
      title: a.decision === 'aprobar' ? `👍 ${p.clientName} ${text}` : `✏️ ${p.clientName} ${text}`,
      body: a.comment ? `"${a.comment}"` : 'Desde su panel.',
    },
  };
}

// ---------- Semanas ----------

/** Pasa a la semana nueva: guarda los objetivos de esta en el historial y deja los no cumplidos */
export function startNewWeek(p: ClientPanel, weekStart: string): ClientPanel {
  const past: PanelWeek[] = p.goals.length ? [{ weekStart: p.weekStart, goals: p.goals }, ...(p.pastWeeks || [])] : p.pastWeeks || [];
  return {
    ...p,
    weekStart,
    pastWeeks: past.slice(0, 12),
    goals: p.goals.filter((g) => !g.done).map((g) => ({ ...g, id: newItemId() })),
  };
}

/** Resumen corto para la lista de paneles */
export function panelSummary(p: ClientPanel) {
  return {
    tasksOpen: p.tasks.filter((t) => !t.done).length,
    tasksDone: p.tasks.filter((t) => t.done).length,
    toApprove: p.pieces.filter((x) => x.state === 'para_aprobar').length,
    changes: p.pieces.filter((x) => x.state === 'cambios').length,
    goalsDone: p.goals.filter((g) => g.done).length,
    goals: p.goals.length,
  };
}
