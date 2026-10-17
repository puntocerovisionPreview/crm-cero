import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from './sanitize';
import {
  AgendaTask,
  AgendaMeeting,
  Project,
  ProjectInstallment,
  IncomeRecord,
  ExpenseRecord,
  WeeklyGoal,
  TimeLog,
  SecondBrainNote,
  DailyAllocation,
  DailyBucketAllocation,
  DailyAllocationBucketId,
  PersonalAccount,
  PersonalCategory,
  PersonalTransaction,
  PersonalRecurring,
  PersonalBudget,
  SavingsGoal,
  StudyItem,
  PersonalFinanceSettings,
  StudioPaymentSettings,
  StudioFixedExpense,
  Client,
  MercadoPagoIncomingPayment,
} from '../types';
import { LinkRelation } from '../lib/links';
import { todayLocal, monthOf, toSafeDateString, normalizeTimestamp } from './dates';
import { DEFAULT_PERSONAL_ACCOUNTS, DEFAULT_PERSONAL_CATEGORIES } from './personalFinance';

// Estado de sincronización real expuesto para AppTopBar
export type SyncStatusState = 'Sincronizado' | 'Sincronizando…' | 'Sin conexión' | 'Error de permisos';

type SyncListener = (status: SyncStatusState) => void;
const syncListeners = new Set<SyncListener>();
let currentSyncStatus: SyncStatusState = 'Sincronizado';

export function getSyncStatus(): SyncStatusState {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncListeners.delete(listener);
  };
}

function updateSyncStatus(status: SyncStatusState) {
  if (currentSyncStatus !== status) {
    currentSyncStatus = status;
    syncListeners.forEach((l) => l(status));
  }
}

// deepSanitize vive en ./sanitize (módulo chico, lo usa también el portal del alumno)
export { deepSanitize };

function sanitize<T extends Record<string, any>>(data: T): T {
  return deepSanitize(data);
}

// --- Normalizadores de Documentos de Firestore a Estado React ---

export function normalizeProject(raw: any, id: string): Project {
  if (!raw || typeof raw !== 'object') {
    return {
      id,
      clientName: '',
      notes: '',
      archived: false,
      status: 'En curso',
      createdAt: todayLocal(),
      updatedAt: todayLocal(),
    };
  }

  const createdAtStr = normalizeTimestamp(raw.createdAt) || todayLocal();
  const updatedAtStr = normalizeTimestamp(raw.updatedAt) || createdAtStr || todayLocal();

  return {
    ...raw,
    id,
    clientName: raw.clientName || 'Cliente sin nombre',
    notes: raw.notes || '',
    archived: Boolean(raw.archived),
    status: raw.status || 'En curso',
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
    startDate: raw.startDate ? toSafeDateString(raw.startDate) : undefined,
    deliveryDate: raw.deliveryDate ? toSafeDateString(raw.deliveryDate) : undefined,
    lastContactDate: raw.lastContactDate ? toSafeDateString(raw.lastContactDate) : undefined,
    estimatedDeliveryDate: raw.estimatedDeliveryDate ? toSafeDateString(raw.estimatedDeliveryDate) : undefined,
    finalDeliveryDate: raw.finalDeliveryDate ? toSafeDateString(raw.finalDeliveryDate) : undefined,
    pafDeliveryDeadline: raw.pafDeliveryDeadline ? toSafeDateString(raw.pafDeliveryDeadline) : undefined,
    pafStartDate: raw.pafStartDate ? toSafeDateString(raw.pafStartDate) : undefined,
    installments: Array.isArray(raw.installments)
      ? raw.installments.map((inst: any, idx: number) => ({
          ...inst,
          id: inst.id || `inst_${idx}`,
          dueDate: toSafeDateString(inst.dueDate),
          paidAt: inst.paidAt ? toSafeDateString(inst.paidAt) : undefined,
        }))
      : [],
    pafInstallmentDates: Array.isArray(raw.pafInstallmentDates)
      ? raw.pafInstallmentDates.map((inst: any, idx: number) => ({
          ...inst,
          id: inst.id || `paf_inst_${idx}`,
          dueDate: toSafeDateString(inst.dueDate),
          paidAt: inst.paidAt ? toSafeDateString(inst.paidAt) : undefined,
        }))
      : undefined,
    consultingSessions: Array.isArray(raw.consultingSessions)
      ? raw.consultingSessions.map((cs: any) => ({
          ...cs,
          date: toSafeDateString(cs.date) || todayLocal(),
          createdAt: normalizeTimestamp(cs.createdAt) || todayLocal(),
        }))
      : undefined,
    pafMilestones: Array.isArray(raw.pafMilestones) ? raw.pafMilestones : undefined,
  };
}

export function normalizeTask(raw: any, id: string): AgendaTask {
  if (!raw || typeof raw !== 'object') {
    return {
      id,
      title: '',
      date: todayLocal(),
      completed: false,
      createdAt: todayLocal(),
    };
  }

  const createdAtStr = normalizeTimestamp(raw.createdAt) || todayLocal();
  const updatedAtStr = raw.updatedAt ? normalizeTimestamp(raw.updatedAt) : undefined;
  const dateStr = toSafeDateString(raw.date) || todayLocal();

  return {
    ...raw,
    id,
    title: raw.title || '',
    date: dateStr,
    completed: Boolean(raw.completed),
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
  };
}

export function normalizeMeeting(raw: any, id: string): AgendaMeeting {
  if (!raw || typeof raw !== 'object') {
    return {
      id,
      title: '',
      date: todayLocal(),
      time: '10:00',
      completed: false,
      createdAt: todayLocal(),
    };
  }

  const createdAtStr = normalizeTimestamp(raw.createdAt) || todayLocal();
  const updatedAtStr = raw.updatedAt ? normalizeTimestamp(raw.updatedAt) : undefined;
  const dateStr = toSafeDateString(raw.date) || todayLocal();

  return {
    ...raw,
    id,
    title: raw.title || '',
    date: dateStr,
    completed: Boolean(raw.completed),
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
  };
}

export function normalizeIncome(raw: any, id: string): IncomeRecord {
  const dateStr = toSafeDateString(raw?.date) || todayLocal();
  return {
    ...raw,
    id,
    date: dateStr,
    month: monthOf(dateStr),
    createdAt: normalizeTimestamp(raw?.createdAt) || dateStr,
  };
}

export function normalizeExpense(raw: any, id: string): ExpenseRecord {
  const dateStr = toSafeDateString(raw?.date) || todayLocal();
  return {
    ...raw,
    id,
    date: dateStr,
    month: monthOf(dateStr),
    createdAt: normalizeTimestamp(raw?.createdAt) || dateStr,
  };
}

export function normalizeWeeklyGoal(raw: any, id: string): WeeklyGoal {
  return {
    ...raw,
    id,
    createdAt: normalizeTimestamp(raw?.createdAt) || todayLocal(),
    updatedAt: raw?.updatedAt ? normalizeTimestamp(raw.updatedAt) : undefined,
  };
}

// ---------------- TASKS ----------------
export function subscribeTasks(
  onChanged: (tasks: AgendaTask[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'tasks');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) {
        updateSyncStatus('Sincronizando…');
      } else if (snapshot.metadata.fromCache && !navigator.onLine) {
        updateSyncStatus('Sin conexión');
      } else {
        updateSyncStatus('Sincronizado');
      }

      const items: AgendaTask[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeTask(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        // Custom order priority within the same day
        const hasOrderA = typeof a.orderIndex === 'number';
        const hasOrderB = typeof b.orderIndex === 'number';
        if (hasOrderA && hasOrderB) return (a.orderIndex as number) - (b.orderIndex as number);
        if (hasOrderA) return -1;
        if (hasOrderB) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeTasks error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveTaskToFirestore(task: AgendaTask): Promise<void> {
  const taskId = task.id || crypto.randomUUID();
  await setDoc(doc(db, 'tasks', taskId), deepSanitize({ ...task, id: taskId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updateTaskInFirestore(taskId: string, updates: Partial<AgendaTask>): Promise<void> {
  const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
  // Si se reprograma, el recordatorio tiene que volver a sonar
  if (('date' in updates || 'time' in updates || 'reminderMinutesBefore' in updates) && !('reminderNotified' in updates)) {
    payload.reminderNotified = false;
    payload.telegramReminded = false;
  }
  if ('projectId' in updates && (updates.projectId === undefined || updates.projectId === null || updates.projectId === '')) {
    payload.projectId = deleteField();
  }
  if ('projectName' in updates && (updates.projectName === undefined || updates.projectName === null || updates.projectName === '')) {
    payload.projectName = deleteField();
  }
  await setDoc(doc(db, 'tasks', taskId), deepSanitize(payload), { merge: true });
}

export async function deleteTaskFromFirestore(taskId: string): Promise<void> {
  await deleteDoc(doc(db, 'tasks', taskId));
}

// ---------------- MEETINGS ----------------
export function subscribeMeetings(
  onChanged: (meetings: AgendaMeeting[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'meetings');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) {
        updateSyncStatus('Sincronizando…');
      } else if (snapshot.metadata.fromCache && !navigator.onLine) {
        updateSyncStatus('Sin conexión');
      } else {
        updateSyncStatus('Sincronizado');
      }

      const items: AgendaMeeting[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeMeeting(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeMeetings error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveMeetingToFirestore(meeting: AgendaMeeting): Promise<void> {
  const meetingId = meeting.id || crypto.randomUUID();
  await setDoc(doc(db, 'meetings', meetingId), deepSanitize({ ...meeting, id: meetingId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updateMeetingInFirestore(meetingId: string, updates: Partial<AgendaMeeting>): Promise<void> {
  const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
  // Si se reprograma, el recordatorio tiene que volver a sonar
  if (('date' in updates || 'time' in updates || 'reminderMinutesBefore' in updates) && !('reminderNotified' in updates)) {
    payload.reminderNotified = false;
    payload.telegramReminded = false;
  }
  if ('projectId' in updates && (updates.projectId === undefined || updates.projectId === null || updates.projectId === '')) {
    payload.projectId = deleteField();
  }
  if ('projectName' in updates && (updates.projectName === undefined || updates.projectName === null || updates.projectName === '')) {
    payload.projectName = deleteField();
  }
  await setDoc(doc(db, 'meetings', meetingId), deepSanitize(payload), { merge: true });
}

export async function deleteMeetingFromFirestore(meetingId: string): Promise<void> {
  await deleteDoc(doc(db, 'meetings', meetingId));
}

// ---------------- PROJECTS ----------------
export function subscribeProjects(
  onChanged: (projects: Project[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'projects');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) {
        updateSyncStatus('Sincronizando…');
      } else if (snapshot.metadata.fromCache && !navigator.onLine) {
        updateSyncStatus('Sin conexión');
      } else {
        updateSyncStatus('Sincronizado');
      }

      const items: Project[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeProject(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (a.clientName || '').localeCompare(b.clientName || '');
      });
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeProjects error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveProjectToFirestore(project: Project): Promise<void> {
  const projectId = project.id || crypto.randomUUID();
  await setDoc(doc(db, 'projects', projectId), deepSanitize({ ...project, id: projectId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updateProjectInFirestore(projectId: string, updates: Partial<Project>): Promise<void> {
  await setDoc(doc(db, 'projects', projectId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', projectId));
}

/**
 * Modifica arrays anidados de un proyecto usando runTransaction para evitar que
 * dos dispositivos o pestañas sobreescriban los cambios mutuamente.
 */
export async function updateProjectWithTransaction(
  projectId: string,
  modifier: (currentProject: Project) => Partial<Project>
): Promise<Project> {
  const projectRef = doc(db, 'projects', projectId);
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(projectRef);
    if (!snap.exists()) {
      throw new Error(`Project ${projectId} not found in Firestore`);
    }
    const current = snap.data() as Project;
    const updates = modifier(current);
    const sanitized = deepSanitize({ ...updates, updatedAt: serverTimestamp() });
    transaction.set(projectRef, sanitized, { merge: true });
    return { ...current, ...updates };
  });
}

// ---------------- TRANSACCIONES DE COBRO COHERENTE ----------------

/**
 * Cobrar una cuota es UNA transacción atómica:
 * 1. Marca installment.paid = true, paidAt = todayLocal() dentro de project.installments
 * 2. Upsert determinístico del IncomeRecord: id = inc_${projectId}_${installmentId}
 */
export async function payInstallmentTransaction(
  projectId: string,
  installmentId: string,
  customAmount?: number,
  fallbackProject?: Project
): Promise<{ incomeId: string }> {
  const cleanInstId = installmentId || `inst_${Date.now()}`;
  const incomeId = `inc_${projectId}_${cleanInstId}`;
  const projectRef = doc(db, 'projects', projectId);
  const incomeRef = doc(db, 'incomes', incomeId);

  await runTransaction(db, async (transaction) => {
    const projSnap = await transaction.get(projectRef);
    let project: Project;

    if (!projSnap.exists()) {
      if (fallbackProject) {
        project = { ...fallbackProject };
      } else {
        throw new Error(`Proyecto ${projectId} no encontrado en Firestore`);
      }
    } else {
      project = projSnap.data() as Project;
    }

    const installments: ProjectInstallment[] = project.installments ? [...project.installments] : [];
    const targetIdx = installments.findIndex((i) => i.id === cleanInstId);

    let amount = customAmount ?? 0;
    let instNumber = 1;
    const today = todayLocal();

    if (targetIdx !== -1) {
      amount = customAmount ?? installments[targetIdx].amount;
      instNumber = installments[targetIdx].number || targetIdx + 1;
      installments[targetIdx] = {
        ...installments[targetIdx],
        paid: true,
        paidAt: today,
        status: 'cobrado',
        incomeRecordId: incomeId,
        amount,
      };
    } else {
      // Si no estaba en el array, lo agregamos para consistencia
      installments.push({
        id: cleanInstId,
        number: installments.length + 1,
        amount,
        dueDate: today,
        paid: true,
        paidAt: today,
        status: 'cobrado',
        incomeRecordId: incomeId,
      });
    }

    const instCurrency = targetIdx !== -1 ? installments[targetIdx].currency : undefined;
    const currency = instCurrency || project.estimatedCurrency || 'USD';

    // Si el proyecto ya usa el array `payments`, el cobro de la cuota también tiene que
    // aparecer ahí; si no, la ficha del proyecto lo mostraba como impago aunque el ingreso existía.
    let payments = project.payments;
    if (Array.isArray(payments) && !payments.some((p) => p.incomeRecordId === incomeId)) {
      payments = [
        {
          id: `pay_${cleanInstId}`,
          projectId,
          amount,
          currency: currency === 'ARS' ? 'ARS' : 'USD',
          date: today,
          method: 'transferencia',
          note: `Cuota ${instNumber}`,
          incomeRecordId: incomeId,
          createdAt: today,
        },
        ...payments,
      ];
    }

    // Actualizar proyecto en la transacción (o crearlo si era fallback)
    transaction.set(projectRef, sanitize({
      ...project,
      installments,
      ...(payments ? { payments } : {}),
      updatedAt: serverTimestamp(),
    }), { merge: true });

    // Upsert IncomeRecord determinístico
    const incomeData: IncomeRecord = {
      id: incomeId,
      title: `${project.clientName || 'Cliente'} - Cuota ${instNumber}`,
      amount,
      currency,
      status: 'cobrado',
      date: today,
      month: monthOf(today),
      projectId: project.id,
      projectName: project.clientName,
      createdAt: today,
    };

    transaction.set(incomeRef, sanitize(incomeData), { merge: true });
  });

  return { incomeId };
}

/**
 * Revertir cobro: marca la cuota como impaga y borra el IncomeRecord asociado de forma atómica.
 */
export async function revertInstallmentPaymentTransaction(
  projectId: string,
  installmentId: string
): Promise<void> {
  const incomeId = `inc_${projectId}_${installmentId}`;
  const projectRef = doc(db, 'projects', projectId);
  const incomeRef = doc(db, 'incomes', incomeId);

  await runTransaction(db, async (transaction) => {
    const projSnap = await transaction.get(projectRef);
    if (projSnap.exists()) {
      const project = projSnap.data() as Project;
      const installments = (project.installments || []).map((i) => {
        if (i.id === installmentId) {
          const { paidAt, incomeRecordId, ...rest } = i;
          return { ...rest, paid: false, status: 'pendiente' as const };
        }
        return i;
      });
      const payments = Array.isArray(project.payments)
        ? project.payments.filter((p) => p.incomeRecordId !== incomeId)
        : undefined;
      transaction.update(projectRef, sanitize({
        installments,
        ...(payments ? { payments } : {}),
        updatedAt: serverTimestamp(),
      }));
    }

    // Borra el ingreso asociado
    transaction.delete(incomeRef);
  });
}

// ---------------- INCOMES ----------------
export function subscribeIncomes(
  onChanged: (incomes: IncomeRecord[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'incomes');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: IncomeRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeIncome(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeIncomes error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveIncomeToFirestore(income: IncomeRecord): Promise<void> {
  const id = income.id || `inc_${crypto.randomUUID()}`;
  const cleanDate = toSafeDateString(income.date) || todayLocal();
  const cleanMonth = monthOf(cleanDate);
  await setDoc(doc(db, 'incomes', id), sanitize({ ...income, id, date: cleanDate, month: cleanMonth }), { merge: true });
}

export async function updateIncomeInFirestore(incomeId: string, updates: Partial<IncomeRecord>): Promise<void> {
  const sanitized = deepSanitize(updates);
  if (sanitized.date) {
    sanitized.date = toSafeDateString(sanitized.date);
    sanitized.month = monthOf(sanitized.date);
  }
  await setDoc(doc(db, 'incomes', incomeId), sanitized, { merge: true });
}

export async function deleteIncomeFromFirestore(incomeId: string): Promise<void> {
  await deleteDoc(doc(db, 'incomes', incomeId));
}

// ---------------- EXPENSES ----------------
export function subscribeExpenses(
  onChanged: (expenses: ExpenseRecord[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'expenses');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: ExpenseRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeExpense(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeExpenses error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveExpenseToFirestore(expense: ExpenseRecord): Promise<void> {
  const id = expense.id || `exp_${crypto.randomUUID()}`;
  const cleanDate = toSafeDateString(expense.date) || todayLocal();
  const cleanMonth = monthOf(cleanDate);
  await setDoc(doc(db, 'expenses', id), deepSanitize({ ...expense, id, date: cleanDate, month: cleanMonth }), { merge: true });
}

export async function updateExpenseInFirestore(expenseId: string, updates: Partial<ExpenseRecord>): Promise<void> {
  const sanitized = deepSanitize(updates);
  if (sanitized.date) {
    sanitized.date = toSafeDateString(sanitized.date);
    sanitized.month = monthOf(sanitized.date);
  }
  await setDoc(doc(db, 'expenses', expenseId), sanitized, { merge: true });
}

export async function deleteExpenseFromFirestore(expenseId: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', expenseId));
}

// ---------------- STUDIO FIXED EXPENSES & RENEWALS ----------------
export function normalizeStudioFixedExpense(data: any, id: string): StudioFixedExpense {
  return {
    id,
    name: data.name || 'Gasto fijo',
    provider: data.provider || '',
    category: data.category || 'otro',
    amount: Number(data.amount) || 0,
    currency: data.currency === 'ARS' ? 'ARS' : 'USD',
    billingCycle: data.billingCycle || 'mensual',
    nextDueDate: toSafeDateString(data.nextDueDate) || todayLocal(),
    lastPaidDate: data.lastPaidDate ? toSafeDateString(data.lastPaidDate) : undefined,
    autoRenew: Boolean(data.autoRenew),
    projectId: data.projectId || undefined,
    clientName: data.clientName || undefined,
    notes: data.notes || '',
    active: data.active !== false,
    paymentMethod: data.paymentMethod || undefined,
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

export function subscribeStudioFixedExpenses(
  onChanged: (expenses: StudioFixedExpense[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'studioFixedExpenses');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: StudioFixedExpense[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeStudioFixedExpense(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => (a.nextDueDate || '').localeCompare(b.nextDueDate || ''));
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeStudioFixedExpenses error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveStudioFixedExpenseToFirestore(item: StudioFixedExpense): Promise<void> {
  const id = item.id || `sfe_${crypto.randomUUID()}`;
  const cleanDueDate = toSafeDateString(item.nextDueDate) || todayLocal();
  await setDoc(doc(db, 'studioFixedExpenses', id), deepSanitize({ ...item, id, nextDueDate: cleanDueDate }), { merge: true });
}

export async function updateStudioFixedExpenseInFirestore(id: string, updates: Partial<StudioFixedExpense>): Promise<void> {
  const sanitized = deepSanitize(updates);
  if (sanitized.nextDueDate) {
    sanitized.nextDueDate = toSafeDateString(sanitized.nextDueDate);
  }
  await setDoc(doc(db, 'studioFixedExpenses', id), sanitized, { merge: true });
}

export async function deleteStudioFixedExpenseFromFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, 'studioFixedExpenses', id));
}

// ---------------- WEEKLY GOALS ----------------
export function subscribeWeeklyGoals(
  onChanged: (goals: WeeklyGoal[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'weeklyGoals');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: WeeklyGoal[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeWeeklyGoal(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeWeeklyGoals error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveWeeklyGoalToFirestore(goal: WeeklyGoal): Promise<void> {
  const id = goal.id || crypto.randomUUID();
  await setDoc(doc(db, 'weeklyGoals', id), deepSanitize({ ...goal, id, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updateWeeklyGoalInFirestore(goalId: string, updates: Partial<WeeklyGoal>): Promise<void> {
  await setDoc(doc(db, 'weeklyGoals', goalId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteWeeklyGoalFromFirestore(goalId: string): Promise<void> {
  await deleteDoc(doc(db, 'weeklyGoals', goalId));
}

// ---------------- MIGRACIÓN IDEMPOTENTE DE MESES ----------------
export async function migrateIncomeAndExpenseMonths(): Promise<void> {
  try {
    const incomesSnap = await getDocs(collection(db, 'incomes'));
    const expensesSnap = await getDocs(collection(db, 'expenses'));
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    incomesSnap.forEach((docSnap) => {
      const data = docSnap.data() as IncomeRecord;
      if (data.date) {
        const correctMonth = monthOf(data.date);
        if (data.month !== correctMonth) {
          ops.push((batch) => batch.update(docSnap.ref, { month: correctMonth }));
        }
      }
    });

    expensesSnap.forEach((docSnap) => {
      const data = docSnap.data() as ExpenseRecord;
      if (data.date) {
        const correctMonth = monthOf(data.date);
        if (data.month !== correctMonth) {
          ops.push((batch) => batch.update(docSnap.ref, { month: correctMonth }));
        }
      }
    });

    if (ops.length > 0) {
      await commitInChunks(ops);
      console.log(`Migración de meses completada: ${ops.length} registros corregidos.`);
    }
  } catch (err) {
    console.warn('Migración de meses omitida o fallida:', err);
  }
}

// ---------------- TIME LOGS (DEDICACIÓN / CONSULTORÍA) ----------------
export function normalizeTimeLog(raw: any, id: string): TimeLog {
  const dateStr = toSafeDateString(raw?.date) || todayLocal();
  return {
    ...raw,
    id,
    date: dateStr,
    description: raw?.description || '',
    durationMinutes: raw?.durationMinutes ?? raw?.minutes ?? 0,
    minutes: raw?.minutes ?? raw?.durationMinutes ?? 0,
    createdAt: normalizeTimestamp(raw?.createdAt) || new Date().toISOString(),
  };
}

export function subscribeTimeLogs(
  onChanged: (logs: TimeLog[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'timeLogs');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: TimeLog[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeTimeLog(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeTimeLogs error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveTimeLogToFirestore(log: TimeLog): Promise<void> {
  const id = log.id || `timelog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await setDoc(doc(db, 'timeLogs', id), deepSanitize({ ...log, id, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteTimeLogFromFirestore(logId: string): Promise<void> {
  await deleteDoc(doc(db, 'timeLogs', logId));
}

// ---------------- DISTRIBUCIÓN DE JORNADA (DAILY TIME BUDGET & TIMEBOXING ELÁSTICO) ----------------
export const DEFAULT_DAILY_BUCKETS: Record<DailyAllocationBucketId, DailyBucketAllocation> = {
  grabacion: {
    id: 'grabacion',
    label: 'Grabación de Video',
    iconName: 'video',
    description: 'Rodaje, tomas, set de grabación y audio',
    allocatedMinutes: 60, // 1h sugerida de arranque
    completedMinutes: 0,
    completed: false,
    note: '',
  },
  edicion: {
    id: 'edicion',
    label: 'Edición & Post',
    iconName: 'scissors',
    description: 'Cortes, ritmo, B-roll, subtítulos y export',
    allocatedMinutes: 60, // 1h sugerida de arranque
    completedMinutes: 0,
    completed: false,
    note: '',
  },
  guion: {
    id: 'guion',
    label: 'Guion & Estructura',
    iconName: 'file-text',
    description: 'Ganchos (hooks), investigación y estructura',
    allocatedMinutes: 30,
    completedMinutes: 0,
    completed: false,
    note: '',
  },
  foco: {
    id: 'foco',
    label: 'Foco / Proyectos',
    iconName: 'laptop',
    description: 'Desarrollo, diseño y entregables cliente',
    allocatedMinutes: 90,
    completedMinutes: 0,
    completed: false,
    note: '',
  },
  gestion: {
    id: 'gestion',
    label: 'Gestión / Clientes',
    iconName: 'message',
    description: 'Mensajes, presupuestos y soporte',
    allocatedMinutes: 30,
    completedMinutes: 0,
    completed: false,
    note: '',
  },
  estrategia: {
    id: 'estrategia',
    label: 'Estrategia / Negocio',
    iconName: 'target',
    description: 'Mejoras internas, prospección y crecimiento',
    allocatedMinutes: 30,
    completedMinutes: 0,
    completed: false,
    note: '',
  },
  buffer: {
    id: 'buffer',
    label: 'Buffer / Descanso',
    iconName: 'coffee',
    description: 'Espacio de descompresión y pausas',
    allocatedMinutes: 30,
    completedMinutes: 0,
    completed: false,
    note: '',
  },
};

export const ALL_BUCKET_KEYS: DailyAllocationBucketId[] = [
  'grabacion',
  'edicion',
  'guion',
  'foco',
  'gestion',
  'estrategia',
  'buffer',
];

export function createDefaultDailyBudget(dateStr: string, targetHours = 6): DailyAllocation {
  const cleanDate = toSafeDateString(dateStr) || todayLocal();
  return {
    id: cleanDate,
    date: cleanDate,
    targetHours,
    isPaused: false,
    mode: 'libre',
    startTime: '',
    activePreset: 'creador',
    activeSession: null,
    buckets: {
      grabacion: { ...DEFAULT_DAILY_BUCKETS.grabacion },
      edicion: { ...DEFAULT_DAILY_BUCKETS.edicion },
      guion: { ...DEFAULT_DAILY_BUCKETS.guion },
      foco: { ...DEFAULT_DAILY_BUCKETS.foco },
      gestion: { ...DEFAULT_DAILY_BUCKETS.gestion },
      estrategia: { ...DEFAULT_DAILY_BUCKETS.estrategia },
      buffer: { ...DEFAULT_DAILY_BUCKETS.buffer },
    },
    updatedAt: new Date().toISOString(),
    notes: '',
  };
}

export function normalizeDailyBudget(raw: any, dateId: string): DailyAllocation {
  const fallback = createDefaultDailyBudget(dateId);
  if (!raw) return fallback;

  const rawBuckets = raw.buckets || {};
  const mergedBuckets: Partial<Record<DailyAllocationBucketId, DailyBucketAllocation>> = {};

  ALL_BUCKET_KEYS.forEach((key) => {
    const fb = DEFAULT_DAILY_BUCKETS[key];
    const userB = rawBuckets[key] || {};
    mergedBuckets[key] = {
      ...fb,
      ...userB,
      id: key,
      allocatedMinutes: typeof userB.allocatedMinutes === 'number' ? userB.allocatedMinutes : fb.allocatedMinutes,
      completedMinutes: typeof userB.completedMinutes === 'number' ? userB.completedMinutes : 0,
      completed: Boolean(userB.completed),
      note: userB.note || '',
    };
  });

  return {
    id: dateId,
    date: toSafeDateString(raw.date) || dateId,
    targetHours: typeof raw.targetHours === 'number' ? raw.targetHours : 6,
    isPaused: Boolean(raw.isPaused),
    mode: raw.mode === 'cronograma' ? 'cronograma' : 'libre',
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '',
    activePreset: raw.activePreset === 'estudio' ? 'estudio' : raw.activePreset === 'todos' ? 'todos' : 'creador',
    activeSession: raw.activeSession ? {
      bucketId: raw.activeSession.bucketId || 'grabacion',
      label: raw.activeSession.label || '',
      initialMinutes: Number(raw.activeSession.initialMinutes) || 45,
      extendedMinutes: Number(raw.activeSession.extendedMinutes) || 0,
      targetEndTimestamp: Number(raw.activeSession.targetEndTimestamp) || 0,
      isRunning: Boolean(raw.activeSession.isRunning),
      isAlarmDismissed: Boolean(raw.activeSession.isAlarmDismissed),
      startedAt: raw.activeSession.startedAt || new Date().toISOString(),
    } : null,
    buckets: mergedBuckets,
    updatedAt: normalizeTimestamp(raw.updatedAt) || new Date().toISOString(),
    notes: raw.notes || '',
  };
}

export function subscribeDailyBudget(
  dateStr: string,
  onChanged: (budget: DailyAllocation) => void,
  onError?: (err: Error) => void
) {
  const cleanDate = toSafeDateString(dateStr) || todayLocal();
  const docRef = doc(db, 'daily_budgets', cleanDate);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onChanged(normalizeDailyBudget(snap.data(), snap.id));
      } else {
        onChanged(createDefaultDailyBudget(cleanDate));
      }
    },
    (err) => {
      console.error(`Firestore subscribeDailyBudget error for ${cleanDate}:`, err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveDailyBudgetToFirestore(budget: DailyAllocation): Promise<void> {
  const cleanDate = toSafeDateString(budget.date || budget.id) || todayLocal();
  const payload = {
    ...budget,
    id: cleanDate,
    date: cleanDate,
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'daily_budgets', cleanDate), deepSanitize(payload), { merge: true });
}

export async function getDailyBudgetFromFirestore(dateStr: string): Promise<DailyAllocation | null> {
  const cleanDate = toSafeDateString(dateStr) || todayLocal();
  const snap = await getDoc(doc(db, 'daily_budgets', cleanDate));
  if (!snap.exists()) return null;
  return normalizeDailyBudget(snap.data(), snap.id);
}

// ---------------- BACKUP EXPORT / IMPORT ----------------
// Todas las colecciones que guarda la app. Si se agrega una colección nueva,
// sumala acá para que entre en el backup, la restauración y el reseteo.
export const ALL_CRM_COLLECTIONS = [
  'tasks',
  'meetings',
  'projects',
  'incomes',
  'expenses',
  'weeklyGoals',
  'timeLogs',
  'notes',
  'links',
  'daily_budgets',
  'studioFixedExpenses',
  'studio_payment_settings',
  'settings',
  'personal_accounts',
  'personal_categories',
  'personal_transactions',
  'personal_recurrings',
  'personal_budgets',
  'personal_savings_goals',
  'personal_study_items',
  'personal_finance_settings',
  'daily_routine',
  'daily_routine_log',
  'student_portals',
  'clients',
  'prospects',
  'prospect_events',
  'prospect_pool',
  'mp_incoming',
] as const;

export type CrmCollectionName = (typeof ALL_CRM_COLLECTIONS)[number];

export interface CrmCompleteBackup {
  exportedAt: string;
  version: string;
  // v3: cada colección se guarda tal cual está en Firestore, como { [id]: datos }
  collections?: Partial<Record<CrmCollectionName, Record<string, any>>>;
  // v1/v2 (formato viejo, se sigue aceptando al importar)
  tasks?: AgendaTask[];
  meetings?: AgendaMeeting[];
  projects?: Project[];
  incomes?: IncomeRecord[];
  expenses?: ExpenseRecord[];
  weeklyGoals?: WeeklyGoal[];
  timeLogs?: TimeLog[];
}

// Firestore rechaza lotes de más de 500 operaciones: partimos en tandas.
const BATCH_LIMIT = 450;

async function commitInChunks(ops: Array<(batch: ReturnType<typeof writeBatch>) => void>): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

// Convierte Timestamps de Firestore a ISO para que el JSON se pueda volver a importar.
function toPlainJson(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(toPlainJson);
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') return normalizeTimestamp(val);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) out[k] = toPlainJson(v);
    return out;
  }
  return val;
}

export async function exportCompleteCrmBackup(): Promise<CrmCompleteBackup> {
  const snaps = await Promise.all(ALL_CRM_COLLECTIONS.map((c) => getDocs(collection(db, c))));
  const collections: CrmCompleteBackup['collections'] = {};
  ALL_CRM_COLLECTIONS.forEach((name, idx) => {
    const docs: Record<string, any> = {};
    snaps[idx].forEach((d) => {
      docs[d.id] = toPlainJson(d.data());
    });
    collections[name] = docs;
  });
  return {
    exportedAt: new Date().toISOString(),
    version: '3.0',
    collections,
  };
}

export async function importCompleteCrmBackup(backup: CrmCompleteBackup): Promise<{ imported: number }> {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Archivo de backup inválido: formato no reconocido');
  }

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  if (backup.collections && typeof backup.collections === 'object') {
    for (const name of ALL_CRM_COLLECTIONS) {
      const docs = backup.collections[name];
      if (!docs || typeof docs !== 'object') continue;
      for (const [id, data] of Object.entries(docs)) {
        if (!id || !data || typeof data !== 'object') continue;
        ops.push((batch) => batch.set(doc(db, name, id), deepSanitize(data), { merge: true }));
      }
    }
  } else {
    // Formato viejo: arrays por colección
    const legacy: Array<[CrmCollectionName, any[] | undefined]> = [
      ['tasks', backup.tasks],
      ['meetings', backup.meetings],
      ['projects', backup.projects],
      ['incomes', backup.incomes],
      ['expenses', backup.expenses],
      ['weeklyGoals', backup.weeklyGoals],
      ['timeLogs', backup.timeLogs],
    ];
    for (const [name, items] of legacy) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item?.id) continue;
        const data = name === 'incomes' || name === 'expenses'
          ? { ...item, month: monthOf(toSafeDateString(item.date) || todayLocal()) }
          : item;
        ops.push((batch) => batch.set(doc(db, name, item.id), deepSanitize(data), { merge: true }));
      }
    }
  }

  if (ops.length === 0) {
    throw new Error('El archivo no contiene datos para restaurar');
  }
  await commitInChunks(ops);
  return { imported: ops.length };
}

// ---------------- RESET ALL FIRESTORE DATA ----------------
export async function resetAllFirestoreData(): Promise<void> {
  for (const col of ALL_CRM_COLLECTIONS) {
    const snap = await getDocs(collection(db, col));
    await commitInChunks(snap.docs.map((d) => (batch) => batch.delete(d.ref)));
  }
}

// ---------------- BIDIRECTIONAL SMART RECONCILIATION ----------------
// Firestore es la ÚNICA fuente de verdad.
// Para evitar que un dispositivo viejo o secundario reviva proyectos/tareas eliminados
// o sobreescriba cambios hechos en otros dispositivos, NUNCA se sube localStorage
// si la base en la nube ya tiene registros.
export async function syncLocalDataWithFirestore(
  localTasks: AgendaTask[],
  localMeetings: AgendaMeeting[],
  localProjects: Project[],
  localIncomes: IncomeRecord[],
  localExpenses: ExpenseRecord[],
  localGoals: WeeklyGoal[],
  localTimeLogs: TimeLog[] = []
): Promise<{ uploaded: number }> {
  try {
    // 1. Verificamos si la base remota de Firestore ya tiene información
    const [tasksSnap, meetingsSnap, projectsSnap, incomesSnap, expensesSnap, goalsSnap, logsSnap] = await Promise.all([
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'meetings')),
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'incomes')),
      getDocs(collection(db, 'expenses')),
      getDocs(collection(db, 'weeklyGoals')),
      getDocs(collection(db, 'timeLogs')),
    ]);

    const totalRemoteDocs =
      tasksSnap.size +
      meetingsSnap.size +
      projectsSnap.size +
      incomesSnap.size +
      expensesSnap.size +
      goalsSnap.size +
      logsSnap.size;

    // Si Firestore ya contiene datos, Firestore es la base central autoritativa.
    // Los listeners onSnapshot de Firestore en cada dispositivo actualizarán el estado local.
    // NO subimos nada de localStorage para no crear duplicados ni revivir elementos borrados.
    if (totalRemoteDocs > 0) {
      updateSyncStatus('Sincronizado');
      return { uploaded: 0 };
    }

    // Únicamente si la base en la nube está 100% vacía (primer inicio absoluto),
    // sembramos los datos locales iniciales en Firestore:
    updateSyncStatus('Sincronizando…');
    let uploadedCount = 0;
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    localTasks.forEach((t) => {
      if (t.id) {
        ops.push((batch) => batch.set(doc(db, 'tasks', t.id), deepSanitize({ ...t, updatedAt: serverTimestamp() }), { merge: true }));
        uploadedCount++;
      }
    });

    localMeetings.forEach((m) => {
      if (m.id) {
        ops.push((batch) => batch.set(doc(db, 'meetings', m.id), deepSanitize({ ...m, updatedAt: serverTimestamp() }), { merge: true }));
        uploadedCount++;
      }
    });

    localProjects.forEach((p) => {
      if (p.id) {
        ops.push((batch) => batch.set(doc(db, 'projects', p.id), deepSanitize({ ...p, updatedAt: serverTimestamp() }), { merge: true }));
        uploadedCount++;
      }
    });

    localIncomes.forEach((i) => {
      if (i.id) {
        ops.push((batch) => batch.set(doc(db, 'incomes', i.id), deepSanitize({ ...i, month: monthOf(i.date) }), { merge: true }));
        uploadedCount++;
      }
    });

    localExpenses.forEach((e) => {
      if (e.id) {
        ops.push((batch) => batch.set(doc(db, 'expenses', e.id), deepSanitize({ ...e, month: monthOf(e.date) }), { merge: true }));
        uploadedCount++;
      }
    });

    localGoals.forEach((g) => {
      if (g.id) {
        ops.push((batch) => batch.set(doc(db, 'weeklyGoals', g.id), deepSanitize({ ...g, updatedAt: serverTimestamp() }), { merge: true }));
        uploadedCount++;
      }
    });

    localTimeLogs.forEach((l) => {
      if (l.id) {
        ops.push((batch) => batch.set(doc(db, 'timeLogs', l.id), deepSanitize({ ...l, updatedAt: serverTimestamp() }), { merge: true }));
        uploadedCount++;
      }
    });

    if (uploadedCount > 0) {
      await commitInChunks(ops);
      console.log(`[Firestore Seed] Base inicial creada en la nube con ${uploadedCount} registros.`);
    }

    updateSyncStatus('Sincronizado');
    return { uploaded: uploadedCount };
  } catch (err) {
    console.error('Error during syncLocalDataWithFirestore:', err);
    updateSyncStatus('Sin conexión');
    return { uploaded: 0 };
  }
}

// ---------------- SEED LOCAL DATA IF EMPTY ----------------
export async function seedLocalDataToFirestoreIfEmpty(
  localTasks: AgendaTask[],
  localMeetings: AgendaMeeting[],
  localProjects: Project[],
  localIncomes: IncomeRecord[],
  localExpenses: ExpenseRecord[],
  localGoals: WeeklyGoal[],
  localTimeLogs: TimeLog[] = []
): Promise<void> {
  await syncLocalDataWithFirestore(
    localTasks,
    localMeetings,
    localProjects,
    localIncomes,
    localExpenses,
    localGoals,
    localTimeLogs
  );
}

// ---------------- NOTES (SEGUNDO CEREBRO / CONOCIMIENTO) ----------------
export function normalizeNote(raw: any, id: string): SecondBrainNote {
  return {
    ...raw,
    id,
    title: raw?.title || 'Nota sin título',
    content: raw?.content || '',
    date: toSafeDateString(raw?.date) || todayLocal(),
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    folder: raw?.folder || undefined,
    pinned: Boolean(raw?.pinned),
    linkedEntityTitles: Array.isArray(raw?.linkedEntityTitles) ? raw.linkedEntityTitles : [],
    createdAt: normalizeTimestamp(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeTimestamp(raw?.updatedAt) || new Date().toISOString(),
  };
}

export function subscribeNotes(
  onChanged: (notes: SecondBrainNote[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'notes');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: SecondBrainNote[] = [];
      snapshot.forEach((docSnap) => {
        items.push(normalizeNote(docSnap.data(), docSnap.id));
      });
      items.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
      onChanged(items);
    },
    (err) => {
      console.error('Firestore subscribeNotes error:', err);
      if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
        updateSyncStatus('Error de permisos');
      }
      if (onError) onError(err);
    }
  );
}

export async function saveNoteToFirestore(note: SecondBrainNote): Promise<void> {
  const id = note.id || `note_${Date.now()}`;
  await setDoc(doc(db, 'notes', id), deepSanitize({ ...note, id, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updateNoteInFirestore(noteId: string, updates: Partial<SecondBrainNote>): Promise<void> {
  await setDoc(doc(db, 'notes', noteId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteNoteFromFirestore(noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'notes', noteId));
}

// ---------------- LINKS INDEX (RELACIONES DERIVADAS) ----------------
export function subscribeLinks(
  onChanged: (links: LinkRelation[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'links');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: LinkRelation[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as LinkRelation);
      });
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribeLinks error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveLinkToFirestore(link: LinkRelation): Promise<void> {
  await setDoc(doc(db, 'links', link.id), deepSanitize(link), { merge: true });
}

export async function deleteLinkFromFirestore(linkId: string): Promise<void> {
  await deleteDoc(doc(db, 'links', linkId));
}

// =========================================================================
// FINANZAS PERSONALES (.Cero Personal Finance)
// =========================================================================

// 1. Cuentas (PersonalAccount)
export function subscribePersonalAccounts(
  onChanged: (accounts: PersonalAccount[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_accounts');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: PersonalAccount[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as PersonalAccount);
      });
      items.sort((a, b) => a.name.localeCompare(b.name));
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalAccounts error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalAccountToFirestore(account: PersonalAccount): Promise<void> {
  const accountId = account.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_accounts', accountId), deepSanitize({ ...account, id: accountId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalAccountInFirestore(accountId: string, updates: Partial<PersonalAccount>): Promise<void> {
  await setDoc(doc(db, 'personal_accounts', accountId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deletePersonalAccountFromFirestore(accountId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_accounts', accountId));
}

// 2. Categorías (PersonalCategory)
export function subscribePersonalCategories(
  onChanged: (categories: PersonalCategory[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_categories');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: PersonalCategory[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as PersonalCategory);
      });
      items.sort((a, b) => a.name.localeCompare(b.name));
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalCategories error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalCategoryToFirestore(category: PersonalCategory): Promise<void> {
  const categoryId = category.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_categories', categoryId), deepSanitize({ ...category, id: categoryId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalCategoryInFirestore(categoryId: string, updates: Partial<PersonalCategory>): Promise<void> {
  await setDoc(doc(db, 'personal_categories', categoryId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deletePersonalCategoryFromFirestore(categoryId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_categories', categoryId));
}

// 3. Transacciones y Movimientos (PersonalTransaction)
export function subscribePersonalTransactions(
  onChanged: (transactions: PersonalTransaction[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_transactions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: PersonalTransaction[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as PersonalTransaction);
      });
      items.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalTransactions error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalTransactionToFirestore(transaction: PersonalTransaction): Promise<void> {
  const transactionId = transaction.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_transactions', transactionId), deepSanitize({ ...transaction, id: transactionId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalTransactionInFirestore(transactionId: string, updates: Partial<PersonalTransaction>): Promise<void> {
  const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
  if ('projectId' in updates && !updates.projectId) payload.projectId = deleteField();
  if ('projectName' in updates && !updates.projectName) payload.projectName = deleteField();
  if ('sourceIncomeId' in updates && !updates.sourceIncomeId) payload.sourceIncomeId = deleteField();
  if ('taskId' in updates && !updates.taskId) payload.taskId = deleteField();
  if ('noteId' in updates && !updates.noteId) payload.noteId = deleteField();
  if ('studyItemId' in updates && !updates.studyItemId) payload.studyItemId = deleteField();
  await setDoc(doc(db, 'personal_transactions', transactionId), deepSanitize(payload), { merge: true });
}

export async function deletePersonalTransactionFromFirestore(transactionId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_transactions', transactionId));
}

// 4. Recurrentes y Suscripciones (PersonalRecurring)
export function subscribePersonalRecurrings(
  onChanged: (recurrings: PersonalRecurring[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_recurrings');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: PersonalRecurring[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as PersonalRecurring);
      });
      items.sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalRecurrings error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalRecurringToFirestore(recurring: PersonalRecurring): Promise<void> {
  const recurringId = recurring.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_recurrings', recurringId), deepSanitize({ ...recurring, id: recurringId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalRecurringInFirestore(recurringId: string, updates: Partial<PersonalRecurring>): Promise<void> {
  await setDoc(doc(db, 'personal_recurrings', recurringId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deletePersonalRecurringFromFirestore(recurringId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_recurrings', recurringId));
}

// 5. Presupuestos Mensuales (PersonalBudget)
export function subscribePersonalBudgets(
  onChanged: (budgets: PersonalBudget[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_budgets');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: PersonalBudget[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as PersonalBudget);
      });
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalBudgets error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalBudgetToFirestore(budget: PersonalBudget): Promise<void> {
  const budgetId = budget.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_budgets', budgetId), deepSanitize({ ...budget, id: budgetId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalBudgetInFirestore(budgetId: string, updates: Partial<PersonalBudget>): Promise<void> {
  await setDoc(doc(db, 'personal_budgets', budgetId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deletePersonalBudgetFromFirestore(budgetId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_budgets', budgetId));
}

// 6. Metas de Ahorro (SavingsGoal)
export function subscribePersonalSavingsGoals(
  onChanged: (goals: SavingsGoal[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_savings_goals');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: SavingsGoal[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as SavingsGoal);
      });
      items.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalSavingsGoals error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalSavingsGoalToFirestore(goal: SavingsGoal): Promise<void> {
  const goalId = goal.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_savings_goals', goalId), deepSanitize({ ...goal, id: goalId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalSavingsGoalInFirestore(goalId: string, updates: Partial<SavingsGoal>): Promise<void> {
  await setDoc(doc(db, 'personal_savings_goals', goalId), deepSanitize({ ...updates, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deletePersonalSavingsGoalFromFirestore(goalId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_savings_goals', goalId));
}

// 7. Inversión en Estudio (StudyItem)
export function subscribePersonalStudyItems(
  onChanged: (items: StudyItem[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'personal_study_items');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: StudyItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data(), id: docSnap.id } as StudyItem);
      });
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribePersonalStudyItems error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalStudyItemToFirestore(item: StudyItem): Promise<void> {
  const itemId = item.id || crypto.randomUUID();
  await setDoc(doc(db, 'personal_study_items', itemId), deepSanitize({ ...item, id: itemId, updatedAt: serverTimestamp() }), { merge: true });
}

export async function updatePersonalStudyItemInFirestore(itemId: string, updates: Partial<StudyItem>): Promise<void> {
  const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
  if ('noteId' in updates && !updates.noteId) payload.noteId = deleteField();
  if ('projectId' in updates && !updates.projectId) payload.projectId = deleteField();
  if ('projectName' in updates && !updates.projectName) payload.projectName = deleteField();
  await setDoc(doc(db, 'personal_study_items', itemId), deepSanitize(payload), { merge: true });
}

export async function deletePersonalStudyItemFromFirestore(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'personal_study_items', itemId));
}

// 8. Ajustes de Finanzas Personales (PersonalFinanceSettings)
export function subscribePersonalFinanceSettings(
  onChanged: (settings: PersonalFinanceSettings) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, 'personal_finance_settings', 'default');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onChanged({ ...docSnap.data(), id: docSnap.id } as PersonalFinanceSettings);
      }
    },
    (err) => {
      console.warn('Firestore subscribePersonalFinanceSettings error:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePersonalFinanceSettingsToFirestore(settings: PersonalFinanceSettings): Promise<void> {
  await setDoc(doc(db, 'personal_finance_settings', 'default'), deepSanitize({ ...settings, updatedAt: serverTimestamp() }), { merge: true });
}

// 9. Datos de Cobro del Estudio (StudioPaymentSettings para WhatsApp y CBU/Alias)
export function subscribeStudioPaymentSettings(
  onChanged: (settings: StudioPaymentSettings) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, 'studio_payment_settings', 'default');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onChanged({ ...docSnap.data(), id: docSnap.id } as StudioPaymentSettings);
      }
    },
    (err) => {
      console.warn('Firestore subscribeStudioPaymentSettings error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveStudioPaymentSettingsToFirestore(settings: StudioPaymentSettings): Promise<void> {
  await setDoc(doc(db, 'studio_payment_settings', 'default'), deepSanitize({ ...settings, updatedAt: serverTimestamp() }), { merge: true });
}

export async function seedPersonalFinanceDefaultsIfEmpty(
  accounts: PersonalAccount[],
  categories: PersonalCategory[]
): Promise<void> {
  try {
    // Se consulta Firestore (no el estado local): en un dispositivo nuevo el localStorage
    // está vacío y antes se pisaban las cuentas/categorías reales con los valores por defecto.
    if (accounts.length === 0) {
      const remote = await getDocs(collection(db, 'personal_accounts'));
      if (remote.empty) {
        for (const acc of DEFAULT_PERSONAL_ACCOUNTS) {
          await savePersonalAccountToFirestore(acc as PersonalAccount);
        }
      }
    }
    const remoteCategories = categories.length === 0 ? await getDocs(collection(db, 'personal_categories')) : null;
    if (remoteCategories?.empty) {
      for (const cat of DEFAULT_PERSONAL_CATEGORIES) {
        await savePersonalCategoryToFirestore(cat as PersonalCategory);
      }
    }
  } catch (err) {
    console.warn('Error seeding default personal finance data:', err);
  }
}



// ---------------- CLIENTES ----------------
export function subscribeClients(onChanged: (clients: Client[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'clients'),
    (snapshot) => {
      const items: Client[] = [];
      snapshot.forEach((d) => items.push({ ...(d.data() as Client), id: d.id }));
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      onChanged(items);
    },
    (err) => {
      console.warn('Firestore subscribeClients error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveClientToFirestore(client: Client): Promise<void> {
  await setDoc(doc(db, 'clients', client.id), deepSanitize({ ...client, updatedAt: serverTimestamp() }), { merge: true });
}

// Crea clientes y vincula proyectos en tandas (planClientLinks decide qué hacer)
export async function applyClientLinks(newClients: Client[], links: { projectId: string; clientId: string }[]): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  newClients.forEach((c) => ops.push((batch) => batch.set(doc(db, 'clients', c.id), deepSanitize(c), { merge: true })));
  links.forEach((l) => ops.push((batch) => batch.set(doc(db, 'projects', l.projectId), { clientId: l.clientId }, { merge: true })));
  await commitInChunks(ops);
}

// ---------------- PAGOS DE MERCADO PAGO PARA REGISTRAR ----------------
// Los guarda el servidor (mp_incoming); acá se leen y se marcan como registrados o descartados.
export function subscribeMpIncoming(onChanged: (items: MercadoPagoIncomingPayment[]) => void) {
  return onSnapshot(
    collection(db, 'mp_incoming'),
    (snapshot) => {
      const items: MercadoPagoIncomingPayment[] = [];
      snapshot.forEach((d) => items.push({ ...(d.data() as MercadoPagoIncomingPayment), id: d.id }));
      items.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
      onChanged(items);
    },
    (err) => console.warn('Firestore subscribeMpIncoming error:', err)
  );
}

export async function markMpIncomingReconciled(
  id: string,
  reconciledTo: NonNullable<MercadoPagoIncomingPayment['reconciledTo']>
): Promise<void> {
  await setDoc(doc(db, 'mp_incoming', id), deepSanitize({ reconciled: true, reconciledTo }), { merge: true });
}
