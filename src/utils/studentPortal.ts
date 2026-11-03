import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AgendaMeeting, PAF_STAGES, Project } from '../types';
import { DEFAULT_PAF_STAGE_EXIT_MILESTONES } from './pafTemplates';
import { addDays, todayLocal, toSafeDateString } from './dates';
import { deepSanitize } from './sanitize';
import { publicMilestones, type PafPlanItem } from '../panels/pafPlan';

/**
 * Portal del alumno (Método PAF)
 *
 * El alumno NUNCA lee el documento del proyecto: la app publica una "foto" con los
 * datos mínimos en `student_portals/{token}`. El token es aleatorio y largo, así que
 * funciona como contraseña del link. Nada de pagos, notas internas ni teléfonos.
 *
 * Cuando se protejan las reglas de Firestore, esta colección debe quedar con
 * `allow get: if true;` (lectura por ID, sin listar) y escritura solo para el operador.
 */

export const STUDENT_PORTALS_COLLECTION = 'student_portals';

export interface StudentPortalSnapshot {
  roadmap?: PafPlanItem[];
  token: string;
  studentName: string;
  programName: string;
  startDate?: string;
  endDate?: string;
  currentWeek?: number;
  totalWeeks: number;
  stages: { name: string; status: 'done' | 'current' | 'pending' }[];
  currentStage: string;
  deliverables: { text: string; done: boolean }[];
  hoursTotal: number;
  hoursDone: number;
  hoursRemaining: number;
  sessions: { date: string; hours?: number; topics?: string; recordingUrl?: string }[];
  nextSession?: { date: string; time?: string };
  graduated: boolean;
  updatedAt: string;
}

// Nombres viejos de etapas que todavía pueden estar guardados en proyectos antiguos
const LEGACY_STAGE_NAMES: Record<string, string> = {
  'Kick-off / Diagnóstico': 'Kick-Off & Diagnóstico',
  'Mes 1: Infraestructura & Web': 'Mes 1: Infra & Web',
  'Mes 2: Adquisición & Ads': 'Mes 2: Ads & VSL',
  'Mes 3: Conversión & Cierres': 'Mes 3: Cierres',
  'Completado / Graduado': 'Graduados',
};

export function canonicalPafStage(stage?: string): string {
  if (!stage) return PAF_STAGES[0];
  return LEGACY_STAGE_NAMES[stage] || stage;
}

export function generatePortalToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getStudentPortalUrl(token: string): string {
  return `${window.location.origin}/alumno/${token}`;
}

export function buildStudentPortalSnapshot(
  project: Project,
  token: string,
  meetings: AgendaMeeting[] = []
): StudentPortalSnapshot {
  const currentStage = canonicalPafStage(project.pafStage);
  const stageNames: string[] = [...PAF_STAGES];
  const currentIdx = Math.max(0, stageNames.indexOf(currentStage));
  const graduated = currentStage === 'Graduados';

  // El checklist puede estar guardado con el nombre nuevo o el viejo de la etapa
  const legacyKey = Object.keys(LEGACY_STAGE_NAMES).find((k) => LEGACY_STAGE_NAMES[k] === currentStage);
  const saved =
    project.pafStageChecklist?.[currentStage] ||
    (legacyKey ? project.pafStageChecklist?.[legacyKey] : undefined);
  const deliverables = (saved || (DEFAULT_PAF_STAGE_EXIT_MILESTONES[currentStage] || []).map((m) => ({ ...m, done: false })))
    .map((m) => ({ text: m.text, done: Boolean(m.done) }));

  const hoursTotal = Math.max(0, project.pafConsultingHoursTotal ?? 26);
  const hoursDone = Math.max(0, project.pafConsultingHoursDone ?? 0);

  const startDate = toSafeDateString(project.pafStartDate || project.startDate) || undefined;
  const totalWeeks = 12;
  const endDate = toSafeDateString(project.deliveryDate) || (startDate ? addDays(startDate, totalWeeks * 7) : undefined);
  const today = todayLocal();
  let currentWeek: number | undefined;
  if (startDate && startDate <= today) {
    const days = Math.floor((Date.parse(today) - Date.parse(startDate)) / 86400000);
    currentWeek = Math.min(totalWeeks, Math.floor(days / 7) + 1);
  }

  // Solo fecha, horas, temas y grabación: la minuta (notes) queda privada
  const sessions = (project.consultingSessions || [])
    .filter((s) => s.completed !== false && s.date && s.date <= today)
    .map((s) => ({
      date: s.date,
      hours: s.durationHours ?? s.hours,
      topics: s.topics || s.topic,
      recordingUrl: s.recordingUrl,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcoming = meetings
    .filter((m) => m.projectId === project.id && !m.completed && m.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];

  return {
    roadmap: publicMilestones(project.pafMilestones || []),
    token,
    studentName: project.clientName,
    programName: project.projectType === 'paf_base' ? 'Método PAF Base' : 'Método PAF Pro',
    startDate,
    endDate,
    currentWeek,
    totalWeeks,
    stages: stageNames.map((name, idx) => ({
      name,
      status: graduated || idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'pending',
    })),
    currentStage,
    deliverables,
    hoursTotal,
    hoursDone,
    hoursRemaining: Math.max(0, Math.round((hoursTotal - hoursDone) * 10) / 10),
    sessions,
    nextSession: upcoming ? { date: upcoming.date, time: upcoming.time } : undefined,
    graduated,
    updatedAt: new Date().toISOString(),
  };
}

// Compara sin la marca de tiempo, para no reescribir si no cambió nada
export function portalSnapshotKey(snap: StudentPortalSnapshot): string {
  const { updatedAt, ...rest } = snap;
  return JSON.stringify(rest);
}

export async function publishStudentPortal(snap: StudentPortalSnapshot): Promise<void> {
  await setDoc(doc(db, STUDENT_PORTALS_COLLECTION, snap.token), deepSanitize(snap));
}

export async function unpublishStudentPortal(token: string): Promise<void> {
  await deleteDoc(doc(db, STUDENT_PORTALS_COLLECTION, token));
}

export function subscribeStudentPortal(
  token: string,
  onChanged: (snap: StudentPortalSnapshot | null) => void,
  onError: (err: Error) => void
) {
  return onSnapshot(
    doc(db, STUDENT_PORTALS_COLLECTION, token),
    (snap) => onChanged(snap.exists() ? (snap.data() as StudentPortalSnapshot) : null),
    onError
  );
}
