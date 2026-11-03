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
  workDays: [1, 2, 3, 4, 5],
  weeklyGoal: 50,
  bookingUrl: '',
  templates: {
    first: 'Hola {saludo}. Mi nombre es Juan, soy el dueño de .Cero.\n{personal}¿me permites realizarte una consulta?',
    firstVariants: [
      '{saludoHora}, {saludo}. Soy Juan, de .Cero.\n{personal}¿me permites hacerte una consulta?',
      'Hola {saludo}, ¿cómo va? Mi nombre es Juan y trabajo con estudios de {rubro}.\n{personal}¿te puedo hacer una pregunta rápida?',
      '{saludoHora}, ¿hablo con alguien de {estudio}? Soy Juan, de .Cero.\n{personal}¿les puedo hacer una consulta breve?',
      'Hola {saludo}. Te escribe Juan, de .Cero.\n{personal}¿tienes un minuto para una consulta sobre el estudio?',
      '{saludoHora} {saludo}, ¿qué tal? Soy Juan.\n{personal}¿me dejas hacerte una pregunta corta?',
      'Hola, ¿cómo están en {estudio}? Mi nombre es Juan, de .Cero.\n{personal}¿puedo hacerles una consulta?',
    ],
    firstB: '',
    followUpQuestion: '{saludo}, ¿pudiste ver lo que te pregunté? Me sirve mucho saber cómo les llegan hoy los clientes a {estudio}.',
    followUpAgree: '¿Te pasa algo así en {estudio}, {nombre}? Te pregunto porque tengo algo que te puede servir.',
    followUpAudit: 'Hola {saludo}, ¿pudiste hacer el diagnóstico? Son 5 minutos y apenas lo completas te grabo un video con lo que veo de {estudio}: {link}',
    secondChance:
      'Hola {saludo}, te escribí hace un tiempo. Soy Juan, de .Cero. Sé que los meses pasan volando: ¿me permites hacerte una consulta rápida sobre cómo les llegan los clientes hoy?',
    booking:
      '¿Pudiste ver el video, {saludo}? Si te sirvió, armemos una llamada de 20 minutos para bajarlo a {estudio}. Elige el horario que te quede cómodo: {agenda}',
    proposal: 'Hola {saludo}, ¿pudiste revisar la propuesta que te envié? Si te queda alguna duda, la vemos en 10 minutos cuando te quede cómodo.',
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
    video: 'Hola {saludo}, como te prometí, aquí va el video con el análisis de {estudio}: {video}\n¿Lo conversamos en una llamada de 20 minutos esta semana?',
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
      firstVariants: t.firstVariants && t.firstVariants.some((x) => x.trim()) ? t.firstVariants : d.templates.firstVariants,
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
export function distributeFirstContacts(count: number, startDate: string, perDay: number, workDays?: number[]): string[] {
  const days: string[] = [];
  let day = startDate;
  let usedToday = 0;
  const valid = workDays && workDays.length ? workDays : [1, 2, 3, 4, 5];
  const isWork = (d: string) => valid.includes(parseLocalDate(d).getDay());
  while (!isWork(day)) day = addDays(day, 1);
  for (let i = 0; i < count; i++) {
    if (usedToday >= Math.max(1, perDay)) {
      do day = addDays(day, 1);
      while (!isWork(day));
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
  | 'snooze'
  | 'do_not_contact'
  | 'they_replied' // te escribió (en cualquier etapa): te toca a vos
  | 'i_replied' // le contestaste (fuera del guion)
  | 'note'; // solo una nota en el historial

export function applyAction(
  p: Prospect,
  action: ProspectAction,
  today: string,
  settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS,
  note?: string
): { updates: Partial<Prospect>; event: Omit<ProspectEvent, 'id' | 'createdAt'> | null } {
  const r = applyActionInner(p, action, today, settings, note);
  // Cualquier mensaje tuyo deja de estar "pendiente de contestar"
  if (OUTBOUND.includes(action) || action.startsWith('conv_answer:')) r.updates.awaitingMe = false;
  return r;
}

const OUTBOUND: ProspectAction[] = [
  'first_contact', 'follow_up', 'audit_sent', 'video_sent', 'call', 'proposal_sent',
  'conv_question_sent', 'conv_empathy_sent', 'conv_agreed', 'i_replied', 'won', 'lost', 'do_not_contact',
];

function applyActionInner(
  p: Prospect,
  action: ProspectAction,
  today: string,
  settings: ProspectingSettings,
  note?: string
): { updates: Partial<Prospect>; event: Omit<ProspectEvent, 'id' | 'createdAt'> | null } {
  const next = addDays(today, settings.followUpDays);
  let updates: Partial<Prospect> = {};
  switch (action) {
    case 'first_contact': {
      const variant = variantFor(p, settings);
      const firstVariant = p.secondChance || variant === 'B' ? undefined : firstVariantIndex(p, settings);
      updates = { stage: 'contactado', followUps: 0, lastContactAt: today, nextActionDate: next, variant, firstVariant, pulledOn: undefined };
      return { updates, event: { prospectId: p.id, type: 'first_contact', date: today, note, variant, firstVariant } };
    }
    case 'they_replied': {
      // Primera respuesta al mensaje en frío: cuenta como "respondió" en las métricas
      if (p.stage === 'contactado' || p.stage === 'nuevo') {
        updates = { stage: 'respondio', followUps: 0, nextActionDate: today, lastOutcomeAt: today, convStep: 'pregunta', lastReplyAt: today, lastReplyNote: note || undefined, awaitingMe: true };
        return { updates, event: { prospectId: p.id, type: 'reply', date: today, note } };
      }
      updates = { awaitingMe: true, lastReplyAt: today, lastReplyNote: note || undefined, lastOutcomeAt: today, nextActionDate: today };
      return { updates, event: null };
    }
    case 'i_replied':
      return { updates: { lastContactAt: today, lastOutcomeAt: today, nextActionDate: next, followUps: 0 }, event: null };
    case 'note':
      return { updates: {}, event: null };
    case 'follow_up':
      updates = { followUps: (p.followUps || 0) + 1, lastContactAt: today, nextActionDate: next };
      break;
    case 'reply':
      updates = { stage: 'respondio', followUps: 0, nextActionDate: today, lastOutcomeAt: today, convStep: 'pregunta', lastReplyAt: today, awaitingMe: true };
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
    case 'call': {
      // note puede traer el día y la hora: "YYYY-MM-DD" o "YYYY-MM-DD HH:MM"
      const m = (note || '').match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?$/);
      updates = { stage: 'llamada', nextActionDate: undefined, callDate: m ? m[1] : today, callTime: m?.[2], proposalSentAt: undefined };
      // reprogramar no cuenta como otra llamada
      const rescheduled = p.stage === 'llamada' && !p.proposalSentAt;
      return { updates, event: rescheduled ? null : { prospectId: p.id, type: 'call', date: today } };
    }
    case 'proposal_sent':
      updates = { stage: 'llamada', proposalSentAt: today, lastContactAt: today, callDate: undefined, nextActionDate: addDays(today, 3) };
      break;
    case 'won':
      updates = { stage: 'cliente', nextActionDate: undefined };
      break;
    case 'lost':
      updates = {
        stage: 'descartado',
        nextActionDate: undefined,
        lostReason: note || p.lostReason,
        // Si no respondió nunca, vuelve a intentarse en 90 días con otro mensaje
        recycleAfter: !p.doNotContact && /sin respuesta/i.test(note || '') && !p.secondChance ? addDays(today, 90) : undefined,
      };
      break;
    case 'do_not_contact':
      updates = { stage: 'descartado', nextActionDate: undefined, doNotContact: true, recycleAfter: undefined, lostReason: 'Pidió que no lo contacten' };
      return { updates, event: { prospectId: p.id, type: 'lost', date: today, note: 'Pidió que no lo contacten' } };
    case 'chatting':
      updates = { stage: 'contactado', followUps: 0, lastContactAt: today, lastOutcomeAt: today, nextActionDate: next };
      return { updates, event: null };
    case 'conv_question_sent':
      return { updates: { convStep: 'esperando_respuesta', lastContactAt: today, lastOutcomeAt: today, followUps: 0, nextActionDate: next }, event: null };
    case 'conv_empathy_sent':
      return { updates: { convStep: 'esperando_acuerdo', lastContactAt: today, lastOutcomeAt: today, followUps: 0, nextActionDate: next }, event: null };
    case 'conv_agreed':
      return { updates: { convStep: 'speech', nextActionDate: today }, event: null };
    case 'snooze':
      // "Mañana": un primer mensaje se pasa de día; el resto, la próxima acción
      return {
        updates: p.stage === 'nuevo' ? { plannedFirstContact: addDays(today, 1), nextActionDate: addDays(today, 1), pulledOn: undefined } : { nextActionDate: addDays(today, 1) },
        event: null,
      };
    default:
      if (action.startsWith('conv_answer:')) {
        const difusion = action.slice('conv_answer:'.length) as DifusionKey;
        return { updates: { difusion, convStep: 'empatia', nextActionDate: today, lastReplyAt: today, lastOutcomeAt: today }, event: null };
      }
  }
  return { updates, event: { prospectId: p.id, type: action as ProspectEventType, date: today, note } };
}

// ---------------- COLA DEL DÍA ----------------

export type QueueKind = 'llamada_hoy' | 'video' | 'responder' | 'llamada' | 'propuesta' | 'seguimiento' | 'primer';

export interface QueueItem {
  prospect: Prospect;
  kind: QueueKind;
  overdueDays: number;
  suggestDiscard: boolean; // ya se le hicieron todos los seguimientos sin respuesta
  hot: boolean;
  localTime?: LocalTime; // hora en su país
}

export const QUEUE_LABELS: Record<QueueKind, string> = {
  llamada_hoy: 'Llamada de hoy',
  video: 'Mandar video de la auditoría',
  responder: 'Respondió: contestarle',
  llamada: '¿Cómo salió la llamada?',
  propuesta: 'Seguimiento de la propuesta',
  seguimiento: 'Seguimiento',
  primer: 'Primer mensaje',
};

const KIND_ORDER: Record<QueueKind, number> = { llamada_hoy: 0, responder: 1, video: 2, llamada: 3, propuesta: 4, seguimiento: 5, primer: 6 };
const MUST_DO: QueueKind[] = ['llamada_hoy', 'video', 'responder', 'llamada', 'propuesta'];
const WAITING_STEPS: ConvStep[] = ['esperando_respuesta', 'esperando_acuerdo'];

/** ¿Ya pasó la hora de la llamada? (hora de Argentina) */
function callPassed(p: Prospect, today: string, now: Date): boolean {
  if (!p.callDate) return false;
  if (p.callDate < today) return true;
  if (p.callDate > today || !p.callTime) return false;
  const [h, m] = p.callTime.split(':').map(Number);
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Cordoba' }));
  return local.getHours() * 60 + local.getMinutes() >= h * 60 + m + 30;
}

// ---------------- HORA EN SU PAÍS ----------------

export const COUNTRY_TZ: Record<string, string> = {
  AR: 'America/Argentina/Buenos_Aires',
  MX: 'America/Mexico_City',
  CO: 'America/Bogota',
  CL: 'America/Santiago',
  PE: 'America/Lima',
  EC: 'America/Guayaquil',
  UY: 'America/Montevideo',
  VE: 'America/Caracas',
  PY: 'America/Asuncion',
  BO: 'America/La_Paz',
  CR: 'America/Costa_Rica',
  BR: 'America/Sao_Paulo',
  ES: 'Europe/Madrid',
};

export interface LocalTime {
  label: string; // "07:40"
  hour: number;
  quality: 'bueno' | 'regular' | 'malo'; // horario para escribir por trabajo
}

/** Qué hora es en el país del contacto (para no escribirle a las 6 de la mañana). */
export function localTimeFor(country: string | undefined, now: Date = new Date()): LocalTime | undefined {
  const tz = country ? COUNTRY_TZ[country] : undefined;
  if (!tz) return undefined;
  const parts = new Intl.DateTimeFormat('es-AR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const hour = Number(parts.find((x) => x.type === 'hour')?.value || 0) % 24;
  const minute = parts.find((x) => x.type === 'minute')?.value || '00';
  const quality = hour >= 9 && hour < 19 ? 'bueno' : (hour >= 8 && hour < 9) || (hour >= 19 && hour < 21) ? 'regular' : 'malo';
  return { label: `${String(hour).padStart(2, '0')}:${minute}`, hour, quality };
}

const TIME_RANK = { bueno: 0, regular: 1, malo: 2 } as const;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Versión del primer mensaje (A/B). Sin segunda versión cargada, siempre A. */
export function variantFor(p: Prospect, settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS): 'A' | 'B' {
  if (!settings.templates.firstB?.trim()) return 'A';
  return p.variant || (hashStr(p.id) % 2 ? 'B' : 'A');
}

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
  settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS,
  now: Date = new Date()
): { items: QueueItem[]; overflow: number } {
  const all: QueueItem[] = [];
  prospects.forEach((p) => {
    if (CLOSED.includes(p.stage)) return;
    let kind: QueueKind | null = null;
    let due = p.nextActionDate || today;
    const dueNow = (p.nextActionDate || today) <= today;
    if (p.awaitingMe) {
      // Te escribió: lo primero es contestarle, esté en la etapa que esté
      kind = 'responder';
      due = p.lastReplyAt || today;
    } else if (p.stage === 'llamada') {
      if (p.proposalSentAt) {
        if (dueNow) kind = 'propuesta';
      } else if (p.callDate === today && !callPassed(p, today, now)) {
        kind = 'llamada_hoy';
      } else if (p.callDate && callPassed(p, today, now)) {
        kind = 'llamada';
        due = p.callDate;
      }
    } else if (p.stage === 'auditoria_completada') {
      kind = 'video';
      due = p.videoDueDate || today;
    } else if (p.stage === 'respondio') {
      // Le hiciste la pregunta o empatizaste y no contestó: seguimiento; si no, te toca a vos
      if (WAITING_STEPS.includes(p.convStep as ConvStep)) {
        if (dueNow) kind = 'seguimiento';
      } else if (dueNow) kind = 'responder';
    } else if (WAITING.includes(p.stage) && dueNow) kind = 'seguimiento';
    else if (p.stage === 'nuevo' && (p.plannedFirstContact || p.createdAt) <= today) {
      kind = 'primer';
      due = p.plannedFirstContact || p.createdAt;
    }
    if (!kind) return;
    // Lo que ya se hizo hoy no vuelve a aparecer
    if ((kind === 'primer' || kind === 'seguimiento' || kind === 'propuesta') && p.lastContactAt === today) return;
    const due2 = kind === 'llamada_hoy' ? today : due;
    all.push({
      prospect: p,
      kind,
      overdueDays: Math.max(0, daysBetween(due2, today)),
      suggestDiscard: kind === 'seguimiento' && (p.followUps || 0) >= settings.maxFollowUps,
      hot: isHot(p),
      localTime: localTimeFor(p.country, now),
    });
  });

  // Dentro de cada tipo: primero a quien le podés escribir ahora (horario de su país),
  // después los calientes y los más atrasados
  all.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      TIME_RANK[a.localTime?.quality || 'bueno'] - TIME_RANK[b.localTime?.quality || 'bueno'] ||
      Number(b.hot) - Number(a.hot) ||
      b.overdueDays - a.overdueDays ||
      a.prospect.name.localeCompare(b.prospect.name)
  );

  // Siempre entran: lo urgente y lo que sumaste a mano hoy. El resto, hasta el tope diario.
  const forced = (i: QueueItem) => MUST_DO.includes(i.kind) || (i.kind === 'primer' && i.prospect.pulledOn === today);
  const mustDo = all.filter(forced);
  const rest = all.filter((i) => !forced(i));
  const room = Math.max(0, settings.dailyCap - mustDo.length);
  return { items: [...mustDo, ...rest.slice(0, room)], overflow: Math.max(0, rest.length - room) };
}

/**
 * Pendientes de días anteriores: les escribiste y nunca anotaste qué pasó.
 * Es lo primero que pide el inicio del día.
 */
export function pendingOutcomes(prospects: Prospect[], today: string): Prospect[] {
  return prospects
    .filter(
      (p) =>
        !!p.lastContactAt &&
        p.lastContactAt < today &&
        (p.lastOutcomeAt || '') < p.lastContactAt &&
        !p.awaitingMe &&
        (['contactado', 'auditoria_enviada', 'video_enviado'].includes(p.stage) ||
          (p.stage === 'respondio' && WAITING_STEPS.includes(p.convStep as ConvStep)) ||
          (p.stage === 'llamada' && !!p.proposalSentAt))
    )
    .sort((a, b) => (a.lastContactAt || '').localeCompare(b.lastContactAt || ''));
}

/** Descartados sin respuesta que ya cumplieron los 90 días: vuelven con otro mensaje. */
export function recycleDue(prospects: Prospect[], today: string): Prospect[] {
  return prospects.filter((p) => p.stage === 'descartado' && !p.doNotContact && !!p.recycleAfter && p.recycleAfter <= today);
}

/** Para el cierre del día: a quiénes les escribiste hoy y todavía no anotaste qué pasó. */
export function pendingDayClose(prospects: Prospect[], today: string): Prospect[] {
  return prospects.filter(
    (p) =>
      p.lastContactAt === today &&
      p.lastOutcomeAt !== today &&
      !p.awaitingMe &&
      !CLOSED.includes(p.stage) &&
      (p.stage !== 'respondio' || WAITING_STEPS.includes(p.convStep as ConvStep))
  );
}

// ---------------- MENSAJES ----------------

export function auditLinkFor(p: Prospect): string {
  return `${AUDIT_URL}?p=${encodeURIComponent(p.id)}`;
}

/** Cómo saludarlo: su @ de Instagram si lo tenemos; si no, el nombre del estudio o de la persona. */
const GENERIC_WORDS = new Set([
  'arquitectura', 'arquitecto', 'arquitecta', 'arquitectos', 'arq', 'estudio', 'diseño', 'diseno', 'construccion', 'construcción',
  'construcciones', 'topografia', 'topografía', 'bim', 'interiorismo', 'interiores', 'paisajismo', 'obras', 'proyectos', 'reformas',
  'remodelaciones', 'y', '&', 'de', 'del', 'la', 'el', 'e', 'en', 'sa', 'srl', 'sas', 'spa', 'ltda',
]);
const SMALL_WORDS = new Set(['de', 'del', 'la', 'el', 'y', 'e', 'en', 'los', 'las']);

/**
 * Nombre presentable del estudio: los de Google Maps vienen en MAYÚSCULAS o con
 * "Nombre - Rubro - Ciudad". Devuelve '' si es solo un rubro ("ARQUITECTURA - DISEÑO"),
 * para no saludar a "Arquitectura y Construcción" como si fuera una persona.
 */
export function cleanStudioName(raw?: string): string {
  let n = (raw || '').trim().replace(/\s+/g, ' ');
  const first = n.split(/\s+[-|/•·–—]\s+|,\s+/)[0].trim();
  if (first.length >= 3) n = first;
  const letters = n.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  if (letters.length > 4 && letters === letters.toUpperCase()) {
    n = n
      .toLowerCase()
      .split(' ')
      .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }
  const words = n.toLowerCase().split(/[\s,.]+/).filter(Boolean);
  if (!words.length || words.every((w) => GENERIC_WORDS.has(w))) return '';
  return n;
}

export function greetingFor(p: Prospect): string {
  const ig = normalizeInstagram(p.instagram);
  if (ig) return `@${ig}`;
  return cleanStudioName(p.studio || p.name);
}

export const DEFAULT_PERSONAL = 'Viendo el enfoque y la trayectoria que tienes en tu estudio, ';

/** La frase personalizada siempre termina en coma, para seguir con "¿me permites...?" */
export function normalizePersonalLine(line?: string): string {
  const t = (line || '').trim().replace(/[.;:!¡?¿\s]+$/, '');
  return t ? `${t}, ` : '';
}

export const SEGMENT_WORD: Record<string, string> = {
  arquitectura: 'arquitectura',
  interiorismo: 'interiorismo',
  paisajismo: 'paisajismo',
  construccion: 'construcción',
};

/**
 * Si todavía no tiene frase personalizada (IA), una de varias aperturas distintas que usan
 * lo que sabemos de él (rubro, ciudad, estudio). Así no le llega a todos la misma frase.
 */
export function personalFallback(p: Prospect): string {
  const rubro = SEGMENT_WORD[p.segment || ''] || 'arquitectura';
  const city = (p.city || '').split(',')[0].trim();
  // Sin repetir el nombre del estudio (el saludo ya lo nombra): suena menos automático
  const options = [
    city ? `Estuve viendo estudios de ${rubro} en ${city} y me encontré con su trabajo, ` : '',
    'Vi los proyectos que publican y me gustó mucho cómo los presentan, ',
    city ? `Me crucé con su trabajo buscando estudios de ${rubro} de ${city}, ` : '',
    'Estuve mirando lo que vienen haciendo últimamente, ',
    'Viendo el enfoque y la trayectoria que tienen, ',
  ].filter(Boolean);
  return options[hashStr(`${p.id}:apertura`) % options.length];
}

/** "Buen día" / "Buenas tardes" / "Buenas noches" según la hora en su país. */
export function timeGreeting(p: Prospect, now: Date = new Date()): string {
  const h = localTimeFor(p.country || 'AR', now)?.hour ?? now.getHours();
  return h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export function renderTemplate(template: string, p: Prospect, settings?: ProspectingSettings, now: Date = new Date()): string {
  const rubro = SEGMENT_WORD[p.segment || ''] || 'arquitectura';
  const greeting = greetingFor(p);
  const studio = cleanStudioName(p.studio) || cleanStudioName(p.name);
  let out = template;
  // Sin nombre presentable: "Hola {saludo}, ¿cómo va?" → "Hola, ¿cómo va?"
  if (!greeting) out = out.replace(/,?\s*\{saludo\}/g, '');
  // {nombre} solo si sabemos el nombre de la persona (en los de Google Maps "nombre" es el estudio)
  const person = p.name && p.studio && cleanStudioName(p.name) !== cleanStudioName(p.studio) ? firstName(p.name) : '';
  if (!person) out = out.replace(/,?\s*\{nombre\}/g, '');
  if (!studio) out = out.replace(/alguien de \{estudio\}/g, 'alguien del estudio').replace(/en \{estudio\}/g, 'en el estudio');
  return out
    .replace(/\{personal\}/g, normalizePersonalLine(p.personalLine) || personalFallback(p))
    .replace(/\{saludoHora\}/g, timeGreeting(p, now))
    .replace(/\{rubro\}/g, rubro)
    .replace(/\{ciudad\}/g, (p.city || '').split(',')[0].trim() || 'tu ciudad')
    .replace(/\{video\}/g, p.videoUrl || '[pega aquí el link del video]')
    .replace(/\{agenda\}/g, bookingLinkFor(p, settings?.bookingUrl) || '[tu link para agendar]')
    .replace(/\{saludo\}/g, greetingFor(p))
    .replace(/\{nombre\}/g, person)
    .replace(/\{estudio\}/g, studio || 'tu estudio')
    .replace(/\{link\}/g, auditLinkFor(p));
}

export function templateFor(item: QueueItem, settings: ProspectingSettings): string {
  const t = settings.templates;
  const p = item.prospect;
  if (item.kind === 'primer') {
    if (p.secondChance && t.secondChance) return t.secondChance;
    if (variantFor(p, settings) === 'B') return t.firstB;
    const pool = firstVariantPool(settings);
    return pool[firstVariantIndex(p, settings)] || t.first;
  }
  if (item.kind === 'video') return t.video;
  if (item.kind === 'llamada' || item.kind === 'llamada_hoy') return '';
  if (item.kind === 'propuesta') return t.proposal;
  if (item.kind === 'seguimiento' && p.stage === 'video_enviado') return t.booking;
  if (item.kind === 'seguimiento' && p.stage === 'auditoria_enviada') return t.followUpAudit || t.followUp[0];
  if (item.kind === 'seguimiento' && p.stage === 'respondio') return p.convStep === 'esperando_acuerdo' ? t.followUpAgree : t.followUpQuestion;
  // Te escribió fuera del guion: la respuesta la escribes vos
  if (item.kind === 'responder' && p.awaitingMe && p.stage !== 'respondio') return '';
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

// ---------------- MÉTRICAS POR GRUPO, A/B Y MOTIVOS ----------------

export interface GroupStat {
  key: string;
  contacted: number;
  replied: number;
  audits: number;
}

/**
 * Tasa de respuesta por país, rubro, prioridad y versión del primer mensaje.
 * "Contactado" = recibió primer mensaje; "respondió" = tiene una respuesta registrada.
 */
export function breakdownBy(
  prospects: Prospect[],
  events: ProspectEvent[],
  keyOf: (p: Prospect) => string | undefined
): GroupStat[] {
  const contacted = new Set(events.filter((e) => e.type === 'first_contact').map((e) => e.prospectId));
  const replied = new Set(events.filter((e) => e.type === 'reply').map((e) => e.prospectId));
  const audits = new Set(events.filter((e) => e.type === 'audit_completed').map((e) => e.prospectId));
  const m = new Map<string, GroupStat>();
  prospects.forEach((p) => {
    if (!contacted.has(p.id)) return;
    const k = keyOf(p);
    if (!k) return;
    const g = m.get(k) || { key: k, contacted: 0, replied: 0, audits: 0 };
    g.contacted++;
    if (replied.has(p.id)) g.replied++;
    if (audits.has(p.id)) g.audits++;
    m.set(k, g);
  });
  return [...m.values()].sort((a, b) => b.contacted - a.contacted);
}

export function scoreTier(score?: number): 'A' | 'B' | 'C' | undefined {
  if (score === undefined) return undefined;
  return score >= 75 ? 'A' : score >= 60 ? 'B' : 'C';
}

/**
 * Aprende de lo que te responden: países que contestan más que el promedio suben en la
 * reserva, los que contestan menos bajan (solo con al menos 8 contactados en ese país).
 */
export function countryBoosts(prospects: Prospect[], events: ProspectEvent[]): Record<string, number> {
  const stats = breakdownBy(prospects, events, (p) => p.country);
  const totalC = stats.reduce((s, g) => s + g.contacted, 0);
  const totalR = stats.reduce((s, g) => s + g.replied, 0);
  if (totalC < 15) return {};
  const avg = totalR / totalC;
  const out: Record<string, number> = {};
  stats.forEach((g) => {
    if (g.contacted < 8) return;
    out[g.key] = Math.max(-8, Math.min(8, Math.round((g.replied / g.contacted - avg) * 40)));
  });
  return out;
}

export function lostReasons(prospects: Prospect[]): { reason: string; count: number }[] {
  const m = new Map<string, number>();
  prospects
    .filter((p) => p.stage === 'descartado' && p.lostReason)
    .forEach((p) => m.set(p.lostReason!, (m.get(p.lostReason!) || 0) + 1));
  return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

/** Reporte de la semana para mandarle a tu mentor (texto para WhatsApp). */
export function weeklyReportText(week: WeekMetrics, goal: number, studioName = '.Cero'): string {
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
  return [
    `Reporte de prospección ${studioName} — ${week.label} (${week.range})`,
    `Conversaciones OUT: ${week.conversacionesOut}${goal ? ` de ${goal} (meta)` : ''}`,
    `Seguimientos: ${week.seguimientos}`,
    `Respuestas: ${week.respuestas} (${pct(week.respuestas, week.conversacionesOut)} de respuesta)`,
    `Auto auditorías: ${week.autoAuditorias}`,
  ].join('\n');
}

// ---------------- LLAMADAS EN LA AGENDA ----------------

/**
 * Link para agendar con su id adentro: Calendly lo devuelve en el aviso de la reserva
 * (utm_content) y así la app sabe exactamente quién agendó.
 */
export function bookingLinkFor(p: Prospect, bookingUrl?: string): string {
  const url = (bookingUrl || '').trim();
  if (!url || !/calendly\.com/i.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=cero&utm_content=${encodeURIComponent(p.id)}`;
}

export const callMeetingId = (prospectId: string) => `call_${prospectId}`.slice(0, 120);

/** La reunión que va a tu agenda (y a Google Calendar si está conectado). */
export function callMeetingFor(
  p: Prospect,
  date: string,
  time: string | undefined,
  minutes = 30,
  today = date,
  extra: { notes?: string } = {}
) {
  const studio = p.studio || p.name;
  return {
    id: callMeetingId(p.id),
    title: `Llamada: ${studio}`,
    date,
    time: time || undefined,
    durationHours: Math.round((minutes / 60) * 100) / 100,
    completed: false,
    createdAt: today,
    clientPhone: p.whatsapp,
    reminderMinutesBefore: 60,
    reminderNotified: false,
    notes: [
      `Prospecto de .Cero${p.city ? ` (${p.city})` : ''}.`,
      p.whatsapp ? `WhatsApp: ${p.whatsapp}` : '',
      p.audit ? `Auditoría ${p.audit.total}/30 (${p.audit.nivel}). Dolor: ${p.audit.dolorCaptacion || '—'}.` : '',
      p.difusion ? `Hoy difunde su trabajo por: ${DIFUSION_LABELS[p.difusion]}.` : '',
      p.lastReplyNote ? `Lo último que te dijo: ${p.lastReplyNote}` : '',
      p.notes ? `Tus notas: ${p.notes}` : '',
      p.videoUrl ? `Video: ${p.videoUrl}` : '',
      extra.notes || '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

// ---------------- VARIANTES DEL PRIMER MENSAJE ----------------

const OLD_FIRST_DEFAULTS = [
  'Hola {saludo}. Mi nombre es Juan, soy el dueño de .Cero.\n{personal}¿me permites realizarte una consulta?',
  'Hola {saludo}. Mi nombre es Juan, soy el dueño de .Cero.\nViendo el enfoque y la trayectoria que tienes en tu estudio, ¿me permites realizarte una consulta?',
];

/** Variantes en uso: las de la configuración + tu primer mensaje si lo escribiste vos. */
export function firstVariantPool(settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS): string[] {
  const t = settings.templates;
  const variants = (t.firstVariants || []).filter((x) => x && x.trim());
  const custom = t.first && t.first.trim() && !OLD_FIRST_DEFAULTS.includes(t.first) ? [t.first] : [];
  const pool = [...custom, ...variants];
  return pool.length ? pool : [t.first];
}

/** Cada prospecto recibe siempre la misma variante (la elegida al azar por su id). */
export function firstVariantIndex(p: Prospect, settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS): number {
  const n = firstVariantPool(settings).length;
  if (p.firstVariant !== undefined && p.firstVariant < n) return p.firstVariant;
  return hashStr(`${p.id}:primer`) % n;
}

// ---------------- A QUIÉN LE TOCA ----------------

export type Turn = 'sin_contactar' | 'mio' | 'suyo' | 'perdido' | 'llamada' | 'cerrado';

export interface TurnInfo {
  turn: Turn;
  label: string; // "Te toca", "Esperando hace 3 días"...
  days: number; // días desde tu último mensaje (si espera)
}

/** Te toca a vos, le toca a él, o ya hay que darlo por perdido. */
export function turnOf(p: Prospect, today: string, settings: ProspectingSettings = DEFAULT_PROSPECTING_SETTINGS): TurnInfo {
  const since = p.lastContactAt ? Math.max(0, daysBetween(p.lastContactAt, today)) : 0;
  const ago = since === 0 ? 'hoy' : since === 1 ? 'hace 1 día' : `hace ${since} días`;
  if (CLOSED.includes(p.stage)) return { turn: 'cerrado', label: STAGE_LABELS[p.stage], days: 0 };
  if (p.stage === 'nuevo') return { turn: 'sin_contactar', label: 'Sin contactar', days: 0 };
  if (p.awaitingMe) return { turn: 'mio', label: `Te escribió${p.lastReplyAt && p.lastReplyAt !== today ? ` el ${p.lastReplyAt.slice(8, 10)}/${p.lastReplyAt.slice(5, 7)}` : ''}: te toca`, days: 0 };
  if (p.stage === 'auditoria_completada') return { turn: 'mio', label: 'Te toca: mandar el video', days: 0 };
  if (p.stage === 'respondio' && !WAITING_STEPS.includes(p.convStep as ConvStep)) return { turn: 'mio', label: 'Te toca seguir la conversación', days: 0 };
  if (p.stage === 'llamada' && !p.proposalSentAt) {
    if (p.callDate && p.callDate >= today) return { turn: 'llamada', label: `Llamada ${p.callDate === today ? 'hoy' : `el ${p.callDate.slice(8, 10)}/${p.callDate.slice(5, 7)}`}${p.callTime ? ` a las ${p.callTime}` : ' (sin hora)'}`, days: 0 };
    return { turn: 'mio', label: 'Te toca: anotar cómo salió la llamada', days: 0 };
  }
  if ((p.followUps || 0) >= settings.maxFollowUps) return { turn: 'perdido', label: `Sin respuesta tras ${p.followUps} seguimientos`, days: since };
  return { turn: 'suyo', label: `Esperando su respuesta (le escribiste ${ago})`, days: since };
}

// ---------------- EMBUDO ----------------

export const FUNNEL_STEPS = [
  { id: 'primer', label: 'Primer mensaje enviado' },
  { id: 'respondio', label: 'Respondió' },
  { id: 'pregunta', label: 'Le hiciste la pregunta' },
  { id: 'difusion', label: 'Contó cómo difunde' },
  { id: 'empatia', label: 'Empatía enviada' },
  { id: 'speech', label: 'Coincidió: speech' },
  { id: 'link', label: 'Link de auditoría enviado' },
  { id: 'auditoria', label: 'Completó la auditoría' },
  { id: 'video', label: 'Video enviado' },
  { id: 'llamada', label: 'Llamada agendada' },
  { id: 'propuesta', label: 'Propuesta enviada' },
  { id: 'cliente', label: 'Cliente' },
] as const;

export type FunnelStepId = (typeof FUNNEL_STEPS)[number]['id'];

/** En qué paso del embudo está (null si todavía no se le escribió o está descartado). */
export function funnelStepOf(p: Prospect): FunnelStepId | null {
  switch (p.stage) {
    case 'contactado':
      return 'primer';
    case 'respondio':
      if (p.convStep === 'esperando_respuesta') return 'pregunta';
      if (p.convStep === 'empatia') return 'difusion';
      if (p.convStep === 'esperando_acuerdo') return 'empatia';
      if (p.convStep === 'speech') return 'speech';
      return 'respondio';
    case 'auditoria_enviada':
      return 'link';
    case 'auditoria_completada':
      return 'auditoria';
    case 'video_enviado':
      return 'video';
    case 'llamada':
      return p.proposalSentAt ? 'propuesta' : 'llamada';
    case 'cliente':
      return 'cliente';
    default:
      return null;
  }
}

/** Llamadas agendadas en un día (para "mañana" y el aviso de la noche anterior). */
export function callsOn(prospects: Prospect[], day: string): Prospect[] {
  return prospects
    .filter((p) => p.stage === 'llamada' && !p.proposalSentAt && p.callDate === day)
    .sort((a, b) => (a.callTime || '99').localeCompare(b.callTime || '99'));
}

/** Llamadas sin hora cargada (las de antes del cambio, o agendadas sin hora). */
export function callsWithoutTime(prospects: Prospect[], today: string): Prospect[] {
  return prospects.filter((p) => p.stage === 'llamada' && !p.proposalSentAt && !p.callTime && (!p.callDate || p.callDate >= today));
}

/** Texto para el historial según la acción. */
export const ACTION_LOG: Partial<Record<string, string>> = {
  first_contact: 'Le mandaste el primer mensaje',
  follow_up: 'Le mandaste un seguimiento',
  reply: 'Te respondió',
  they_replied: 'Te escribió',
  i_replied: 'Le contestaste',
  no_reply: 'No respondió',
  conv_question_sent: 'Le hiciste la pregunta',
  conv_empathy_sent: 'Le mandaste la empatía',
  conv_agreed: 'Coincidió con lo que le dijiste',
  audit_sent: 'Le pasaste el link de la auditoría',
  audit_completed: 'Completó la auditoría',
  video_sent: 'Le mandaste el video',
  call: 'Agendaron la llamada',
  proposal_sent: 'Le mandaste la propuesta',
  won: 'Pasó a cliente',
  lost: 'Lo descartaste',
  do_not_contact: 'Pidió que no lo contacten',
  snooze: 'Lo pasaste para mañana',
};

export function logEntryFor(action: ProspectAction, note?: string): { dir: 'in' | 'out' | 'nota'; text: string } | null {
  if (action === 'note') return note ? { dir: 'nota', text: note } : null;
  if (action.startsWith('conv_answer:')) {
    const k = action.slice('conv_answer:'.length) as DifusionKey;
    return { dir: 'in', text: `Te contó cómo difunde: ${DIFUSION_LABELS[k] || k}` };
  }
  const base = ACTION_LOG[action];
  if (!base) return null;
  const dir = action === 'they_replied' || action === 'reply' || action === 'conv_agreed' || action === 'audit_completed' ? 'in' : 'out';
  const extra = note && !/^\d{4}-\d{2}-\d{2}/.test(note) ? `: ${note}` : action === 'call' && note ? ` (${note})` : '';
  return { dir, text: `${base}${extra}` };
}
