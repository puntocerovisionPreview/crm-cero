import { ConvStep, DifusionKey, Prospect, ProspectAudit, ProspectEvent, ProspectEventType, ProspectingSettings, ProspectStage, Project } from '../types';
import { addDays, parseLocalDate } from '../utils/dates';
import { normalizeClientName } from '../utils/clients';

/**
 * PROSPECCIÓN EN FRÍO — lógica pura (sin Firebase): la usan la app, el servidor y las pruebas.
 *
 * Embudo: Conversación OUT → Seguimientos → Respuesta → Auto auditoría (quiz)
 *         → Video personalizado (24-48 hs) → Llamada → Cliente
 */

export const AUDIT_URL = 'https://somospuntocero.online/auditoria';

const DEFAULT_SPEECH =
  'Justamente por eso armé un diagnóstico gratuito para estudios: en 5 minutos te muestra en qué nivel está tu presencia, cómo te llegan los clientes y dónde se están perdiendo oportunidades. Cuando lo completas, te mando un video personalizado con 2 o 3 acciones concretas para {estudio}. Te lo dejo acá: {link}';

export const DEFAULT_PROSPECTING_SETTINGS: ProspectingSettings = {
  followUpDays: 2,
  maxFollowUps: 3,
  dailyCap: 8,
  firstContactsPerDay: 2,
  closeHour: 18,
  weeklyBatchSize: 10,
  poolCountries: [],
  poolSegments: [],
  templates: {
    first:
      'Hola {saludo}. Mi nombre es Juan, soy el dueño de .Cero.\nViendo el enfoque y la trayectoria que tienes en tu estudio, ¿me permites realizarte una consulta?',
    followUp: [
      'Hola {saludo}, ¿pudiste ver mi mensaje? Me gustaría hacerte una consulta rápida sobre tu estudio.',
      '{saludo}, te escribo de nuevo por si se perdió el mensaje. Es una consulta corta, ¿me permites?',
      'Último mensaje, {saludo}: si en algún momento te interesa que conversemos sobre cómo llegar a más clientes, escríbeme. ¡Muchos éxitos con {estudio}!',
    ],
    question: '¿Cómo haces para difundir tu trabajo y llegar a más personas?',
    empathy: {
      portales:
        'Te entiendo totalmente, la mayoría de estudios depende solamente de los portales y ambos sabemos que a veces dependemos de la suerte, ¿verdad?',
      referidos:
        'Te entiendo, es lo más común: el boca en boca trae buenos clientes, pero no se puede controlar cuándo llegan. Hay meses llenos y meses vacíos, ¿verdad?',
      anuncios:
        'Qué bien que ya inviertas en anuncios. Lo que veo seguido es que se paga por clics pero llegan consultas que no encajan con el tipo de proyecto que buscas, ¿te pasa algo así?',
      redes:
        'Genial que uses las redes. Lo difícil es que publicar no siempre se convierte en consultas de clientes reales, y a veces se siente como hablarle a la nada, ¿verdad?',
      contenido_ig:
        'Te entiendo, subir contenido de vez en cuando es lo que hace la mayoría, porque el día a día del estudio no deja tiempo. El tema es que así es difícil que lleguen consultas constantes, ¿verdad?',
      agencia:
        'Qué bueno que ya trabajes con alguien. Muchos estudios me cuentan que la agencia les da publicaciones lindas, pero no saben cuántos clientes les trae realmente, ¿te pasa algo parecido?',
      otro:
        'Te entiendo. La mayoría de los estudios con los que hablo sienten que les falta un sistema que les traiga clientes de forma constante, ¿te pasa algo parecido?',
    },
    speech: DEFAULT_SPEECH,
    audit: DEFAULT_SPEECH,
    video:
      'Hola {saludo}, como te prometí, aquí va el video con el análisis de {estudio}: [pega aquí el link del video]\n¿Lo conversamos en una llamada de 20 minutos esta semana?',
  },
};

export const DIFUSION_LABELS: Record<DifusionKey, string> = {
  portales: 'Portales',
  referidos: 'Referidos / boca en boca',
  anuncios: 'Anuncios',
  redes: 'Redes sociales',
  contenido_ig: 'Algo de contenido en IG',
  agencia: 'Agencia / community',
  otro: 'Otra cosa',
};

export const CONV_STEP_LABELS: Record<ConvStep, string> = {
  pregunta: 'Hacerle la pregunta',
  esperando_respuesta: 'Esperando cómo difunde su trabajo',
  empatia: 'Empatizar con su respuesta',
  esperando_acuerdo: 'Esperando que coincida',
  speech: 'Speech y link de auditoría',
};

/** Completa la configuración guardada con los valores por defecto (incluidos los textos nuevos). */
export function mergeProspectingSettings(saved: Partial<ProspectingSettings> | undefined): ProspectingSettings {
  const t = (saved?.templates || {}) as Partial<ProspectingSettings['templates']>;
  const d = DEFAULT_PROSPECTING_SETTINGS;
  return {
    ...d,
    ...(saved || {}),
    templates: {
      ...d.templates,
      ...t,
      followUp: t.followUp && t.followUp.length ? t.followUp : d.templates.followUp,
      empathy: { ...d.templates.empathy, ...(t.empathy || {}) },
    },
  };
}

export const STAGE_LABELS: Record<ProspectStage, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  respondio: 'Respondió',
  auditoria_enviada: 'Auditoría enviada',
  auditoria_completada: 'Auditoría completada',
  video_enviado: 'Video enviado',
  llamada: 'Llamada',
  cliente: 'Cliente',
  descartado: 'Descartado',
};

const CLOSED: ProspectStage[] = ['cliente', 'descartado'];
const WAITING: ProspectStage[] = ['contactado', 'auditoria_enviada', 'video_enviado'];

// ---------------- NORMALIZACIÓN Y CARGA ----------------

export function normalizePhone(raw?: string): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * Clave para comparar teléfonos argentinos escritos de distintas formas
 * ("0351 15-555-1234" y "+54 9 351 555 1234" son el mismo): últimos 7 dígitos,
 * que son el número del abonado sin 0, 15, 54 ni 9.
 */
export function phoneKey(raw?: string): string {
  const d = normalizePhone(raw);
  return d.length >= 7 ? d.slice(-7) : '';
}

export function normalizeInstagram(raw?: string): string {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return '';
  const fromUrl = v.match(/instagram\.com\/([a-z0-9._]+)/);
  return (fromUrl ? fromUrl[1] : v.replace(/^@/, '')).replace(/\/$/, '');
}

export function firstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

export interface ParsedRow {
  name: string;
  studio?: string;
  instagram?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  source?: string;
  notes?: string;
}

const HEADER_KEYS: Array<[keyof ParsedRow, RegExp]> = [
  ['studio', /estudio|empresa|negocio|marca/],
  ['name', /nombre|contacto|persona|due[nñ]o/],
  ['instagram', /insta|^ig$/],
  ['whatsapp', /whats|tel|cel|m[oó]vil|n[uú]mero/],
  ['email', /mail|correo/],
  ['city', /ciudad|zona|localidad|provincia/],
  ['source', /fuente|origen|canal/],
  ['notes', /nota|observ|comentario/],
];

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map((c) => c.trim());
  // CSV simple con comillas
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function guessCell(cell: string): keyof ParsedRow | null {
  if (/instagram\.com\//i.test(cell) || /^@[\w.]+$/.test(cell)) return 'instagram';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) return 'email';
  if (normalizePhone(cell).length >= 8 && /^[+\d\s()-]+$/.test(cell)) return 'whatsapp';
  return null;
}

/**
 * Convierte lo que pegás desde Excel / Google Sheets (o un CSV) en filas.
 * Si la primera fila tiene encabezados (Nombre, Estudio, Instagram...) los usa;
 * si no, adivina por el formato de cada celda (@usuario, email, teléfono) y el resto
 * va en orden: nombre, estudio, ciudad.
 */
export function parsePastedProspects(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const firstCells = splitLine(lines[0], delimiter).map((c) => c.toLowerCase());
  const headerMap: Array<keyof ParsedRow | null> = firstCells.map((c) => {
    const hit = HEADER_KEYS.find(([, re]) => re.test(c));
    return hit ? hit[0] : null;
  });
  const hasHeader = headerMap.filter(Boolean).length >= 2;
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line) => {
      const cells = splitLine(line, delimiter);
      const row: Partial<ParsedRow> = {};
      if (hasHeader) {
        cells.forEach((c, i) => {
          const key = headerMap[i];
          if (key && c && !row[key]) (row as any)[key] = c;
        });
      } else {
        const free: string[] = [];
        cells.forEach((c) => {
          if (!c) return;
          const key = guessCell(c);
          if (key && !row[key]) (row as any)[key] = c;
          else free.push(c);
        });
        if (free[0]) row.name = free[0];
        if (free[1]) row.studio = free[1];
        if (free[2]) row.city = free[2];
      }
      if (!row.name && row.studio) row.name = row.studio;
      if (!row.name && row.instagram) row.name = normalizeInstagram(row.instagram);
      return row.name ? (row as ParsedRow) : null;
    })
    .filter((r): r is ParsedRow => Boolean(r));
}

export interface DuplicateMatch {
  kind: 'prospecto' | 'cliente';
  label: string;
}

/** ¿Ya lo tenés como prospecto o como cliente? Compara WhatsApp, Instagram y nombre. */
export function findDuplicate(row: ParsedRow, prospects: Prospect[], projects: Project[] = []): DuplicateMatch | null {
  const phone = phoneKey(row.whatsapp);
  const ig = normalizeInstagram(row.instagram);
  const key = normalizeClientName(row.studio || row.name);
  const p = prospects.find(
    (x) =>
      (phone && phoneKey(x.whatsapp) === phone) ||
      (ig && normalizeInstagram(x.instagram) === ig) ||
      (key && normalizeClientName(x.studio || x.name) === key)
  );
  if (p) return { kind: 'prospecto', label: `Ya está en prospección (${STAGE_LABELS[p.stage]})` };
  const c = projects.find(
    (x) =>
      (phone && phoneKey(x.clientPhone) === phone) ||
      (ig && normalizeInstagram(x.instagramUrl) === ig) ||
      (key && normalizeClientName(x.clientName) === key)
  );
  if (c) return { kind: 'cliente', label: `Ya es cliente (${c.clientName})` };
  return null;
}

function isWeekday(dateStr: string): boolean {
  const d = parseLocalDate(dateStr).getDay();
  return d >= 1 && d <= 5;
}

/** Reparte los primeros mensajes de la tanda en días hábiles, de a `perDay`, empezando hoy. */
export function distributeFirstContacts(count: number, startDate: string, perDay: number): string[] {
  const days: string[] = [];
  let day = startDate;
  let usedToday = 0;
  while (!isWeekday(day)) day = addDays(day, 1);
  for (let i = 0; i < count; i++) {
    if (usedToday >= Math.max(1, perDay)) {
      do day = addDays(day, 1);
      while (!isWeekday(day));
      usedToday = 0;
    }
    days.push(day);
    usedToday++;
  }
  return days;
}

export function newProspectFromRow(row: ParsedRow, plannedFirstContact: string, today: string): Prospect {
  return {
    id: `pros_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: row.name.trim(),
    studio: row.studio?.trim() || undefined,
    instagram: row.instagram?.trim() || undefined,
    whatsapp: row.whatsapp?.trim() || undefined,
    email: row.email?.trim() || undefined,
    city: row.city?.trim() || undefined,
    source: row.source?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    stage: 'nuevo',
    createdAt: today,
    plannedFirstContact,
    nextActionDate: plannedFirstContact,
    followUps: 0,
  };
}

// ---------------- ACCIONES ----------------

// 'chatting' = sigue la conversación (respondió pero todavía no le pasaste la auditoría).
// Los pasos del guion ('conv_*') y 'snooze' tampoco suman en las métricas.
export type ProspectAction =
  | ProspectEventType
  | 'chatting'
  | 'conv_question_sent'
  | `conv_answer:${DifusionKey}`
  | 'conv_empathy_sent'
  | 'conv_agreed'
  | 'snooze';

export function applyAction(
  p: Prospect,
  action: ProspectAction,
  today: string,
  settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS,
  note?: string
): { updates: Partial<Prospect>; event: Omit<ProspectEvent, 'id' | 'createdAt'> | null } {
  const next = addDays(today, settings.followUpDays);
  let updates: Partial<Prospect> = {};
  switch (action) {
    case 'first_contact':
      updates = { stage: 'contactado', followUps: 0, lastContactAt: today, nextActionDate: next };
      break;
    case 'follow_up':
      updates = { followUps: (p.followUps || 0) + 1, lastContactAt: today, nextActionDate: next };
      break;
    case 'reply':
      updates = { stage: 'respondio', followUps: 0, nextActionDate: today, lastOutcomeAt: today, convStep: 'pregunta' };
      break;
    case 'no_reply':
      updates = { lastOutcomeAt: today };
      break;
    case 'audit_sent':
      updates = { stage: 'auditoria_enviada', followUps: 0, lastContactAt: today, nextActionDate: next, convStep: undefined };
      break;
    case 'audit_completed':
      updates = { stage: 'auditoria_completada', nextActionDate: today, videoDueDate: addDays(today, 2) };
      break;
    case 'video_sent':
      updates = { stage: 'video_enviado', followUps: 0, lastContactAt: today, nextActionDate: next };
      break;
    case 'call':
      updates = { stage: 'llamada', nextActionDate: undefined };
      break;
    case 'won':
      updates = { stage: 'cliente', nextActionDate: undefined };
      break;
    case 'lost':
      updates = { stage: 'descartado', nextActionDate: undefined, lostReason: note || p.lostReason };
      break;
    case 'chatting':
      updates = { stage: 'contactado', followUps: 0, lastContactAt: today, lastOutcomeAt: today, nextActionDate: next };
      return { updates, event: null };
    case 'conv_question_sent':
      return { updates: { convStep: 'esperando_respuesta', lastContactAt: today, lastOutcomeAt: today }, event: null };
    case 'conv_empathy_sent':
      return { updates: { convStep: 'esperando_acuerdo', lastContactAt: today, lastOutcomeAt: today }, event: null };
    case 'conv_agreed':
      return { updates: { convStep: 'speech', nextActionDate: today }, event: null };
    case 'snooze':
      return { updates: { nextActionDate: addDays(today, 1) }, event: null };
    default:
      if (action.startsWith('conv_answer:')) {
        const difusion = action.slice('conv_answer:'.length) as DifusionKey;
        return { updates: { difusion, convStep: 'empatia', nextActionDate: today }, event: null };
      }
  }
  return { updates, event: { prospectId: p.id, type: action as ProspectEventType, date: today, note } };
}

// ---------------- COLA DEL DÍA ----------------

export type QueueKind = 'video' | 'responder' | 'seguimiento' | 'primer';

export interface QueueItem {
  prospect: Prospect;
  kind: QueueKind;
  overdueDays: number;
  suggestDiscard: boolean; // ya se le hicieron todos los seguimientos sin respuesta
  hot: boolean;
}

export const QUEUE_LABELS: Record<QueueKind, string> = {
  video: 'Mandar video de la auditoría',
  responder: 'Respondió: contestarle',
  seguimiento: 'Seguimiento',
  primer: 'Primer mensaje',
};

const KIND_ORDER: Record<QueueKind, number> = { video: 0, responder: 1, seguimiento: 2, primer: 3 };

const BIG_STUDIO = ['4 a 7 proyectos', '8 a 15 proyectos', 'Más de 15 proyectos'];

/** "Caliente": la auditoría muestra que necesita lo que vendés y que puede pagarlo. */
export function isHot(p: Prospect): boolean {
  const a = p.audit;
  if (!a) return false;
  return (a.funnel <= 5 || a.adquisicion <= 5) && BIG_STUDIO.includes(a.proyectosActivos || '');
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000);
}

/**
 * Lista del día, ya ordenada: videos pendientes, respuestas, seguimientos y primeros mensajes.
 * Videos y respuestas siempre entran; el resto se completa hasta el tope diario.
 */
export function buildDailyQueue(
  prospects: Prospect[],
  today: string,
  settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS
): { items: QueueItem[]; overflow: number } {
  const all: QueueItem[] = [];
  prospects.forEach((p) => {
    if (CLOSED.includes(p.stage) || p.stage === 'llamada') return;
    let kind: QueueKind | null = null;
    let due = p.nextActionDate || today;
    if (p.stage === 'auditoria_completada') {
      kind = 'video';
      due = p.videoDueDate || today;
    } else if (p.stage === 'respondio' && (p.nextActionDate || today) <= today) kind = 'responder';
    else if (WAITING.includes(p.stage) && (p.nextActionDate || today) <= today) kind = 'seguimiento';
    else if (p.stage === 'nuevo' && (p.plannedFirstContact || p.createdAt) <= today) {
      kind = 'primer';
      due = p.plannedFirstContact || p.createdAt;
    }
    if (!kind) return;
    // Lo que ya se hizo hoy no vuelve a aparecer
    if (kind !== 'video' && kind !== 'responder' && p.lastContactAt === today) return;
    all.push({
      prospect: p,
      kind,
      overdueDays: Math.max(0, daysBetween(due, today)),
      suggestDiscard: kind === 'seguimiento' && (p.followUps || 0) >= settings.maxFollowUps,
      hot: isHot(p),
    });
  });

  all.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      Number(b.hot) - Number(a.hot) ||
      b.overdueDays - a.overdueDays ||
      a.prospect.name.localeCompare(b.prospect.name)
  );

  const mustDo = all.filter((i) => i.kind === 'video' || i.kind === 'responder');
  const rest = all.filter((i) => i.kind !== 'video' && i.kind !== 'responder');
  const room = Math.max(0, settings.dailyCap - mustDo.length);
  return { items: [...mustDo, ...rest.slice(0, room)], overflow: Math.max(0, rest.length - room) };
}

/** Para el cierre del día: a quiénes les escribiste hoy y todavía no anotaste qué pasó. */
export function pendingDayClose(prospects: Prospect[], today: string): Prospect[] {
  return prospects.filter(
    (p) => p.lastContactAt === today && p.lastOutcomeAt !== today && !CLOSED.includes(p.stage) && p.stage !== 'respondio'
  );
}

// ---------------- MENSAJES ----------------

export function auditLinkFor(p: Prospect): string {
  return `${AUDIT_URL}?p=${encodeURIComponent(p.id)}`;
}

/** Cómo saludarlo: su @ de Instagram si lo tenemos; si no, el nombre del estudio o de la persona. */
export function greetingFor(p: Prospect): string {
  const ig = normalizeInstagram(p.instagram);
  if (ig) return `@${ig}`;
  return (p.studio || p.name || '').trim();
}

export function renderTemplate(template: string, p: Prospect): string {
  return template
    .replace(/\{saludo\}/g, greetingFor(p))
    .replace(/\{nombre\}/g, firstName(p.name))
    .replace(/\{estudio\}/g, p.studio || 'tu estudio')
    .replace(/\{link\}/g, auditLinkFor(p));
}

export function templateFor(item: QueueItem, settings: ProspectingSettings): string {
  const t = settings.templates;
  if (item.kind === 'primer') return t.first;
  if (item.kind === 'video') return t.video;
  if (item.kind === 'responder') {
    const step = item.prospect.convStep || 'pregunta';
    if (step === 'pregunta' || step === 'esperando_respuesta') return t.question;
    if (step === 'empatia' || step === 'esperando_acuerdo') return t.empathy[item.prospect.difusion || 'otro'] || t.empathy.otro;
    return t.speech || t.audit;
  }
  const idx = Math.min(item.prospect.followUps || 0, t.followUp.length - 1);
  return t.followUp[idx] || t.followUp[0];
}

// ---------------- AUDITORÍA (desde la web) ----------------

const num = (v: any) => {
  const n = parseInt(String(v ?? '').split('/')[0], 10);
  return isNaN(n) ? 0 : n;
};

/** Convierte lo que manda el formulario de la web en los datos de auditoría del prospecto. */
export function auditFromWebPayload(body: Record<string, any>, completedAtIso: string): ProspectAudit {
  const respuestas: Record<string, string> = {};
  for (let i = 1; i <= 15; i++) {
    const v = body[`q${i}_respuesta`];
    if (v) respuestas[`q${i}`] = String(v).slice(0, 80);
  }
  const clip = (v: any) => (v ? String(v).slice(0, 500) : undefined);
  return {
    completedAt: completedAtIso,
    total: num(body.score_total),
    presencia: num(body.score_presencia),
    adquisicion: num(body.score_adquisicion),
    funnel: num(body.score_funnel),
    nivel: clip(body.nivel_paf) || '',
    dedicacion: clip(body.dedicacion),
    tamanioEquipo: clip(body.tamanio_equipo),
    dolorCaptacion: clip(body.dolor_captacion),
    origenClientes: clip(body.origen_clientes),
    inversionPrevia: clip(body.inversion_previamk),
    proyectosActivos: clip(body.proyectos_activos),
    ciudad: clip(body.ciudad_zona),
    observaciones: clip(body.observaciones),
    respuestas,
  };
}

/** Busca a quién corresponde una auditoría: primero por el link personal (?p=), después por contacto. */
export function matchAuditToProspect(body: Record<string, any>, prospects: Prospect[]): Prospect | null {
  const ref = String(body.ref || '').trim();
  if (ref) {
    const byRef = prospects.find((p) => p.id === ref);
    if (byRef) return byRef;
  }
  const phone = phoneKey(body.whatsapp);
  const ig = normalizeInstagram(body.instagram);
  const email = String(body.email || '').trim().toLowerCase();
  const studio = normalizeClientName(String(body.nombre_estudio || ''));
  return (
    prospects.find(
      (p) =>
        (phone && phoneKey(p.whatsapp) === phone) ||
        (ig && normalizeInstagram(p.instagram) === ig) ||
        (email && (p.email || '').toLowerCase() === email) ||
        (studio && normalizeClientName(p.studio || '') === studio)
    ) || null
  );
}

// ---------------- MÉTRICAS (tabla del mentor) ----------------

export interface WeekMetrics {
  label: string; // "Semana 1"
  range: string; // "1–5 oct"
  start: string;
  end: string;
  conversacionesOut: number;
  seguimientos: number;
  respuestas: number;
  autoAuditorias: number;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Semanas del mes (lunes a domingo), recortadas al mes. Puede haber una 5ª o 6ª semana. */
export function monthWeeks(monthKey: string): { start: string; end: string }[] {
  const [y, m] = monthKey.split('-').map(Number);
  const first = `${monthKey}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  const weeks: { start: string; end: string }[] = [];
  let start = first;
  while (start <= last) {
    const dow = parseLocalDate(start).getDay(); // 0 domingo
    const toSunday = dow === 0 ? 0 : 7 - dow;
    const end = addDays(start, toSunday) > last ? last : addDays(start, toSunday);
    weeks.push({ start, end });
    start = addDays(end, 1);
  }
  return weeks;
}

export function computeMonthMetrics(events: ProspectEvent[], monthKey: string): WeekMetrics[] {
  return monthWeeks(monthKey).map((w, i) => {
    const inWeek = events.filter((e) => e.date >= w.start && e.date <= w.end);
    const count = (t: ProspectEventType) => inWeek.filter((e) => e.type === t).length;
    const s = parseLocalDate(w.start);
    const e = parseLocalDate(w.end);
    return {
      label: `Semana ${i + 1}`,
      range: `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`,
      start: w.start,
      end: w.end,
      conversacionesOut: count('first_contact'),
      seguimientos: count('follow_up'),
      respuestas: new Set(inWeek.filter((x) => x.type === 'reply').map((x) => x.prospectId)).size,
      autoAuditorias: count('audit_completed'),
    };
  });
}

/** CSV con la misma forma que la planilla del mentor (se abre con Excel). */
export function metricsToCsv(weeks: WeekMetrics[]): string {
  const header = ['MÉTRICAS', ...weeks.map((w) => `${w.label.toUpperCase()} (${w.range})`), 'TOTAL'];
  const row = (label: string, key: keyof WeekMetrics) => {
    const vals = weeks.map((w) => Number(w[key]));
    return [label, ...vals.map(String), String(vals.reduce((a, b) => a + b, 0))];
  };
  const rows = [
    header,
    row('Conversaciones OUT', 'conversacionesOut'),
    row('Seguimientos', 'seguimientos'),
    row('Respuestas', 'respuestas'),
    row('Auto Auditorias', 'autoAuditorias'),
  ];
  return '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n');
}
