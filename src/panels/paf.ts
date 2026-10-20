import { Project } from '../types';
import { isPafProject } from '../utils/projectTimeline';
import { canonicalPafStage } from '../utils/studentPortal';
import { ClientPanel } from './model';

/** Alumno PAF que está cursando (no archivado, no graduado, no "No concretado") */
export function isActivePafStudent(p: Project): boolean {
  return !p.archived && isPafProject(p) && p.status !== 'No concretado' && canonicalPafStage(p.pafStage) !== 'Graduados';
}

/** Alumnos PAF activos que todavía no tienen panel */
export function pafWithoutPanel(projects: Project[], panels: ClientPanel[]): Project[] {
  const linked = new Set(panels.map((x) => x.projectId).filter(Boolean));
  return projects.filter((p) => isActivePafStudent(p) && !linked.has(p.id)).sort((a, b) => a.clientName.localeCompare(b.clientName));
}
