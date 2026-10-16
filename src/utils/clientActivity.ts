import { Project, AgendaTask, AgendaMeeting, TimeLog } from '../types';
import { getTodayString } from './storage';
import { toSafeDateString } from './dates';
import { taskBelongsToProject } from './taskProject';

export interface ClientInactivityInfo {
  daysInactive: number;
  isInactive15: boolean;
  isInactive30: boolean;
  lastActivityDate: string;
  statusLevel: 'active' | 'warning' | 'critical';
  badgeLabel: string;
}

/**
 * Calculates days since last interaction/contact with a client/project
 */
export function getClientInactivityInfo(
  project: Project,
  tasks: AgendaTask[] = [],
  meetings: AgendaMeeting[] = [],
  timeLogs: TimeLog[] = []
): ClientInactivityInfo {
  const todayStr = getTodayString();
  const todayTime = new Date(todayStr).getTime();

  const dates: string[] = [];

  // Project timestamps
  const dUpdated = toSafeDateString(project.updatedAt);
  if (dUpdated) dates.push(dUpdated);

  const dStart = toSafeDateString(project.startDate);
  if (dStart) dates.push(dStart);

  const dCreated = toSafeDateString(project.createdAt);
  if (dCreated) dates.push(dCreated);

  const dContact = toSafeDateString(project.lastContactDate);
  if (dContact) dates.push(dContact);

  // PAF installments paid dates
  if (project.pafInstallmentDates) {
    project.pafInstallmentDates.forEach(i => {
      const pDate = toSafeDateString(i.paidAt);
      if (pDate) dates.push(pDate);
    });
  }

  // Related meetings
  const relatedMeetings = meetings.filter(
    m => m.projectId === project.id || 
         (m.title && m.title.toLowerCase().includes(project.clientName.toLowerCase()))
  );
  relatedMeetings.forEach(m => {
    if (m.date) dates.push(m.date);
  });

  // Related tasks
  const relatedTasks = tasks.filter(t => taskBelongsToProject(t, project));
  relatedTasks.forEach(t => {
    if (t.date) dates.push(t.date);
  });

  // Time logs
  const relatedLogs = timeLogs.filter(l => l.projectId === project.id);
  relatedLogs.forEach(l => {
    if (l.date) dates.push(l.date);
  });

  // Sort descending to find the latest date
  dates.sort((a, b) => b.localeCompare(a));
  const latestDate = dates[0] || todayStr;

  const latestTime = new Date(latestDate).getTime();
  const daysDiff = Math.max(0, Math.floor((todayTime - latestTime) / (1000 * 60 * 60 * 24)));

  let statusLevel: 'active' | 'warning' | 'critical' = 'active';
  let badgeLabel = 'Al día';

  if (daysDiff >= 30) {
    statusLevel = 'critical';
    badgeLabel = `${daysDiff}d inactivo`;
  } else if (daysDiff >= 15) {
    statusLevel = 'warning';
    badgeLabel = `${daysDiff}d sin contacto`;
  }

  return {
    daysInactive: daysDiff,
    isInactive15: daysDiff >= 15,
    isInactive30: daysDiff >= 30,
    lastActivityDate: latestDate,
    statusLevel,
    badgeLabel,
  };
}
