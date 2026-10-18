import type { AgendaTask, Project, TaskPriority } from '../types';
import { addDays } from './dates';

/**
 * PLANTILLAS DE ARRANQUE
 * Al sumar un cliente, con un toque se crean las tareas de arranque con sus fechas.
 * Las fechas se cuentan desde el día en que aplicás la plantilla.
 */

export type TemplateKey = 'web' | 'paf';

export interface TemplateStep {
  day: number;
  title: string;
  priority?: TaskPriority;
}

export const ONBOARDING_TEMPLATES: Record<TemplateKey, { label: string; steps: TemplateStep[] }> = {
  web: {
    label: 'Sitio web',
    steps: [
      { day: 0, title: 'Reunión de arranque: objetivos y referencias', priority: 'alta' },
      { day: 1, title: 'Pedir accesos, logo, textos y fotos' },
      { day: 3, title: 'Propuesta de estructura (mapa del sitio)' },
      { day: 7, title: 'Diseño de la página de inicio', priority: 'alta' },
      { day: 10, title: 'Revisión de diseño con el cliente' },
      { day: 17, title: 'Desarrollo y carga de contenido' },
      { day: 21, title: 'Revisión final y ajustes' },
      { day: 24, title: 'Publicación y dominio', priority: 'alta' },
      { day: 31, title: 'Pedir reseña en Google y testimonio' },
    ],
  },
  paf: {
    label: 'Mentoría PAF',
    steps: [
      { day: 0, title: 'Kick-off: llamada de bienvenida y objetivos', priority: 'alta' },
      { day: 1, title: 'Enviar accesos y materiales del programa' },
      { day: 7, title: 'Sesión 1:1 de la semana 1' },
      { day: 14, title: 'Revisar avance de la semana 2' },
      { day: 30, title: 'Cierre del mes 1: revisión de métricas', priority: 'alta' },
      { day: 60, title: 'Cierre del mes 2: revisión de métricas' },
      { day: 84, title: 'Graduación: resultados y testimonio', priority: 'alta' },
    ],
  },
};

export function templateFor(project: Project): TemplateKey {
  return project.serviceType === 'paf' || String(project.projectType || '').startsWith('paf') ? 'paf' : 'web';
}

export function buildOnboardingTasks(project: Project, key: TemplateKey, startDate: string): Omit<AgendaTask, 'id' | 'createdAt'>[] {
  return ONBOARDING_TEMPLATES[key].steps.map((s) => ({
    title: s.title,
    date: addDays(startDate, s.day),
    completed: false,
    priority: s.priority || 'media',
    projectId: project.id,
    projectName: project.clientName,
  }));
}
