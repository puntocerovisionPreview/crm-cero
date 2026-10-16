import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AgendaTask, Project } from '../types';
import { normalizeText } from './taskProject';

export interface RepairResult {
  repairedCount: number;
  unmatchedCount: number;
  unmatchedTasks: { id: string; title: string; date: string; projectName?: string }[];
  updatedTasks: AgendaTask[];
  alreadySyncedCount: number;
}

/**
 * Idempotently repairs task-project links across all tasks:
 * - If task has projectName but no projectId: resolves project by name and adds projectId.
 * - If task has projectId but no projectName: resolves project by ID and adds projectName.
 * - If neither, attempts title-based match if unambiguous.
 * - Persists updates to Firestore in batches of up to 400 documents.
 */
export async function repairTaskProjectLinks(
  tasks: AgendaTask[],
  projects: Project[]
): Promise<RepairResult> {
  const updatedTasks: AgendaTask[] = [];
  const modifiedTasks: AgendaTask[] = [];
  const unmatchedTasks: { id: string; title: string; date: string; projectName?: string }[] = [];
  let alreadySyncedCount = 0;

  for (const task of tasks) {
    let needsUpdate = false;
    let newProjectId = task.projectId;
    let newProjectName = task.projectName;

    // Case 1: Has projectName but missing or empty projectId
    if (task.projectName && (!task.projectId || task.projectId.trim() === '')) {
      const normName = normalizeText(task.projectName);
      const matched = projects.find(p => 
        normalizeText(p.clientName) === normName ||
        (p.ownerName && normalizeText(p.ownerName) === normName)
      );

      if (matched) {
        newProjectId = matched.id;
        newProjectName = matched.clientName; // Normalize to exact current project name
        needsUpdate = true;
      } else {
        unmatchedTasks.push({
          id: task.id,
          title: task.title,
          date: task.date,
          projectName: task.projectName,
        });
      }
    } 
    // Case 2: Has projectId but missing or empty projectName
    else if (task.projectId && task.projectId.trim() !== '' && (!task.projectName || task.projectName.trim() === '')) {
      const matched = projects.find(p => p.id === task.projectId);
      if (matched) {
        newProjectName = matched.clientName;
        needsUpdate = true;
      } else {
        unmatchedTasks.push({
          id: task.id,
          title: task.title,
          date: task.date,
          projectName: undefined,
        });
      }
    }
    // Case 3: Has both, but projectName is outdated compared to project.clientName
    else if (task.projectId && task.projectName) {
      const matched = projects.find(p => p.id === task.projectId);
      if (matched && matched.clientName !== task.projectName) {
        newProjectName = matched.clientName;
        needsUpdate = true;
      } else if (!matched) {
        // Project ID was deleted or not found
        unmatchedTasks.push({
          id: task.id,
          title: task.title,
          date: task.date,
          projectName: task.projectName,
        });
      } else {
        alreadySyncedCount++;
      }
    }
    // Case 4: Neither projectId nor projectName exists -> check unique title match
    else if (!task.projectId && !task.projectName && task.title) {
      const normTitle = normalizeText(task.title);
      const matched = projects.filter(p => {
        const normClient = normalizeText(p.clientName);
        return normClient.length >= 4 && normTitle.includes(normClient);
      });

      if (matched.length === 1) {
        newProjectId = matched[0].id;
        newProjectName = matched[0].clientName;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const updatedTask: AgendaTask = {
        ...task,
        projectId: newProjectId,
        projectName: newProjectName,
      };
      updatedTasks.push(updatedTask);
      modifiedTasks.push(updatedTask);
    } else {
      updatedTasks.push(task);
    }
  }

  // Batch write modified tasks to Firestore (chunks of 400)
  if (modifiedTasks.length > 0) {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < modifiedTasks.length; i += CHUNK_SIZE) {
      const chunk = modifiedTasks.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const t of chunk) {
        const ref = doc(db, 'tasks', t.id);
        const updatePayload: Record<string, any> = {};
        if (t.projectId !== undefined) updatePayload.projectId = t.projectId;
        if (t.projectName !== undefined) updatePayload.projectName = t.projectName;
        batch.update(ref, updatePayload);
      }

      await batch.commit();
    }
  }

  return {
    repairedCount: modifiedTasks.length,
    unmatchedCount: unmatchedTasks.length,
    unmatchedTasks,
    updatedTasks,
    alreadySyncedCount,
  };
}
