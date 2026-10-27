import type { PafMilestone, Project } from '../types';
import { PAF_BASE_MILESTONES, PAF_PRO_MILESTONES } from '../utils/pafTemplates';

export type PafWorkStatus = 'pendiente' | 'en_curso' | 'esperando_cliente' | 'entregado';
export const PAF_WORK_LABELS: Record<PafWorkStatus, string> = {
  pendiente: 'Próximamente', en_curso: 'En curso', esperando_cliente: 'Necesitamos tu aporte', entregado: 'Entregado',
};
export const PAF_MONTHS = [
  { month: 1, title: 'Construimos tu presencia', weeks: 'Semanas 1–4', description: 'Definimos tu propuesta y ordenamos la base digital de tu estudio.' },
  { month: 2, title: 'Activamos la adquisición', weeks: 'Semanas 5–8', description: 'Conectamos contenido, campañas y canales para atraer consultas alineadas.' },
  { month: 3, title: 'Mejoramos la conversión', weeks: 'Semanas 9–12', description: 'Revisamos resultados, afinamos el seguimiento y dejamos el sistema preparado para continuar.' },
] as const;
export interface PafPlanItem {
  id: string;
  title: string;
  month: 1 | 2 | 3;
  week?: number;
  pillar: PafMilestone['pillar'];
  status: PafWorkStatus;
  detail?: string;
}
export interface PafPlan {
  goal: string;
  items: PafPlanItem[];
  cm: { enabled: boolean; scope: string };
  resources: { id: string; title: string; url: string }[];
}

/** Solo campos destinados al cliente. Nunca publica notas, cobros o accesos internos. */
export function publicMilestones(items: PafMilestone[]): PafPlanItem[] {
  return items.map((m) => ({
    id: m.id, title: m.title, month: m.month, week: m.week, pillar: m.pillar,
    status: m.completed ? 'entregado' : 'pendiente',
  }));
}

export function createPafPlan(project?: Pick<Project, 'projectType' | 'pafMilestones'>): PafPlan {
  const saved = project?.pafMilestones;
  const defaults = project?.projectType === 'paf_base' ? PAF_BASE_MILESTONES : PAF_PRO_MILESTONES;
  const items = saved?.length ? publicMilestones(saved) : publicMilestones(defaults.map((m, i) => ({ ...m, id: `paf-${i + 1}`, completed: false })));
  return {
    goal: '', items,
    cm: { enabled: true, scope: 'Estrategia, calendario y revisión de contenido. La cantidad de piezas, las redes, la publicación y la atención de mensajes se acuerdan con tu estudio.' },
    resources: [],
  };
}

export function safeResourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function planProgress(plan: PafPlan) {
  const total = plan.items.length;
  const done = plan.items.filter((i) => i.status === 'entregado').length;
  return { total, done, percent: total ? Math.round(done * 100 / total) : 0 };
}
