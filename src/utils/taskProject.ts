import { AgendaTask, Project } from '../types';

/**
 * Normalizes text for comparison: lowercases, removes diacritics/accents, trims whitespace.
 */
export function normalizeText(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Single Source of Truth for task-project relationship.
 * Priority order:
 * 1. task.projectId === project.id -> true
 * 2. If task has a defined, non-empty projectId AND it differs from project.id -> false
 *    (NEVER match by name or title if task explicitly belongs to another project).
 * 3. If task has NO projectId (or empty) and task.projectName matches project.clientName -> true
 * 4. If task has NO projectId and NO projectName, and task.title contains project.clientName (last fallback) -> true
 * 5. Otherwise -> false
 */
export function taskBelongsToProject(
  task: AgendaTask | undefined | null,
  project: Project | undefined | null
): boolean {
  if (!task || !project || !project.id) return false;

  // 1. Direct ID match
  if (task.projectId && task.projectId === project.id) {
    return true;
  }

  // 2. Strict isolation: if task already has a DIFFERENT projectId, never cross-link
  if (task.projectId && task.projectId.trim() !== '' && task.projectId !== project.id) {
    return false;
  }

  const normClientName = normalizeText(project.clientName);
  if (!normClientName) return false;

  // 3. Name match if task has no projectId
  if (task.projectName && task.projectName.trim() !== '') {
    const normTaskProj = normalizeText(task.projectName);
    if (normTaskProj === normClientName) {
      return true;
    }
    // Also match if ownerName is present and matches
    if (project.ownerName && normalizeText(project.ownerName) === normTaskProj) {
      return true;
    }
  }

  // 4. Title fallback ONLY if neither projectId nor projectName is set
  const hasNoProjectBinding = (!task.projectId || task.projectId.trim() === '') &&
                              (!task.projectName || task.projectName.trim() === '');
  if (hasNoProjectBinding && task.title) {
    const normTitle = normalizeText(task.title);
    if (normTitle.includes(normClientName)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the real project of a task from a list of projects:
 * 1. Checks projectId first
 * 2. Checks projectName second
 * 3. Falls back to unique title match
 */
export function resolveTaskProject(
  task: AgendaTask | undefined | null,
  projects: Project[]
): Project | undefined {
  if (!task || !projects || projects.length === 0) return undefined;

  // 1. Match by projectId
  if (task.projectId && task.projectId.trim() !== '') {
    const matchedById = projects.find(p => p.id === task.projectId);
    if (matchedById) return matchedById;
  }

  // 2. Match by projectName (only if projectId wasn't matched)
  if (task.projectName && task.projectName.trim() !== '') {
    const normTaskProj = normalizeText(task.projectName);
    const matchedByName = projects.find(p => 
      normalizeText(p.clientName) === normTaskProj ||
      (p.ownerName && normalizeText(p.ownerName) === normTaskProj)
    );
    if (matchedByName) return matchedByName;
  }

  // 3. Fallback to title substring match only if completely unbound
  const hasNoProjectBinding = (!task.projectId || task.projectId.trim() === '') &&
                              (!task.projectName || task.projectName.trim() === '');
  if (hasNoProjectBinding && task.title) {
    const normTitle = normalizeText(task.title);
    const matchedByTitle = projects.filter(p => {
      const normClient = normalizeText(p.clientName);
      return normClient.length >= 3 && normTitle.includes(normClient);
    });
    if (matchedByTitle.length === 1) {
      return matchedByTitle[0];
    }
  }

  return undefined;
}

/**
 * Filter all tasks belonging to a specific project using the single source of truth.
 */
export function getTasksForProject(tasks: AgendaTask[], project: Project): AgendaTask[] {
  if (!tasks || !project) return [];
  return tasks.filter(t => taskBelongsToProject(t, project));
}
