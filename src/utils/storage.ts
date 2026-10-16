import { 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  IncomeRecord, 
  ExpenseRecord, 
  WeeklyGoal, 
  TimeLog, 
  SecondBrainNote, 
  AppDataPayload,
  PersonalAccount,
  PersonalCategory,
  PersonalTransaction,
  PersonalRecurring,
  PersonalBudget,
  SavingsGoal,
  StudyItem,
  PersonalFinanceSettings,
  StudioPaymentSettings,
  TrashItem,
  StudioFixedExpense,
  MercadoPagoIncomingPayment
} from '../types';
import { LinkRelation } from '../lib/links';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'cero_v3_auth_token',
  TASKS: 'cero_v3_tasks',
  MEETINGS: 'cero_v3_meetings',
  PROJECTS: 'cero_v3_projects',
  INCOMES: 'cero_v3_incomes',
  EXPENSES: 'cero_v3_expenses',
  WEEKLY_GOALS: 'cero_v3_weekly_goals',
  TIME_LOGS: 'cero_v3_time_logs',
  NOTES: 'cero_v3_notes',
  LINKS: 'cero_v3_links',
  THEME: 'cero_theme',
  PERSONAL_ACCOUNTS: 'cero_v3_personal_accounts',
  PERSONAL_CATEGORIES: 'cero_v3_personal_categories',
  PERSONAL_TRANSACTIONS: 'cero_v3_personal_transactions',
  PERSONAL_RECURRINGS: 'cero_v3_personal_recurrings',
  PERSONAL_BUDGETS: 'cero_v3_personal_budgets',
  PERSONAL_SAVINGS_GOALS: 'cero_v3_personal_savings_goals',
  PERSONAL_STUDY_ITEMS: 'cero_v3_personal_study_items',
  PERSONAL_SETTINGS: 'cero_v3_personal_settings',
  STUDIO_PAYMENT_SETTINGS: 'cero_v3_studio_payment_settings',
  STUDIO_FIXED_EXPENSES: 'cero_v3_studio_fixed_expenses',
  TRASH: 'cero_v3_trash',
  MERCADOPAGO_PAYMENTS: 'cero_v3_mp_payments',
};

// Safe storage helpers
export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Error reading localStorage key ${key}:`, err);
    return fallback;
  }
}

export function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving localStorage key ${key}:`, err);
  }
}

// Auth Token management
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

export function saveStoredAuthToken(token: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

export function removeStoredAuthToken(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
}

// Date helpers
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayString(): string {
  return formatDate(new Date());
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function formatDayName(dateStr: string): string {
  const d = parseDate(dateStr);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[d.getDay()];
}

export function formatShortDay(dateStr: string): string {
  const d = parseDate(dateStr);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  return `${dayName} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function getWeekMonday(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return formatDate(monday);
}

export function formatWeekRange(weekMondayStr: string): string {
  const monday = parseDate(weekMondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} al ${sunday.getDate()} de ${months[monday.getMonth()]}`;
  }
  return `${monday.getDate()} ${months[monday.getMonth()]} al ${sunday.getDate()} ${months[sunday.getMonth()]}`;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTH_SHORT_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function formatMonthTitle(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// 0-Data Default Store getters & setters (NO MOCK DATA)
export function getStoredTasks(): AgendaTask[] {
  return loadFromStorage<AgendaTask[]>(STORAGE_KEYS.TASKS, []);
}

export function saveStoredTasks(tasks: AgendaTask[]): void {
  saveToStorage(STORAGE_KEYS.TASKS, tasks);
}

export function getStoredMeetings(): AgendaMeeting[] {
  return loadFromStorage<AgendaMeeting[]>(STORAGE_KEYS.MEETINGS, []);
}

export function saveStoredMeetings(meetings: AgendaMeeting[]): void {
  saveToStorage(STORAGE_KEYS.MEETINGS, meetings);
}

export function getStoredProjects(): Project[] {
  return loadFromStorage<Project[]>(STORAGE_KEYS.PROJECTS, []);
}

export function saveStoredProjects(projects: Project[]): void {
  saveToStorage(STORAGE_KEYS.PROJECTS, projects);
}

export function getStoredIncomes(): IncomeRecord[] {
  return loadFromStorage<IncomeRecord[]>(STORAGE_KEYS.INCOMES, []);
}

export function saveStoredIncomes(incomes: IncomeRecord[]): void {
  saveToStorage(STORAGE_KEYS.INCOMES, incomes);
}

export function getStoredExpenses(): ExpenseRecord[] {
  return loadFromStorage<ExpenseRecord[]>(STORAGE_KEYS.EXPENSES, []);
}

export function saveStoredExpenses(expenses: ExpenseRecord[]): void {
  saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
}

export function getStoredWeeklyGoals(): WeeklyGoal[] {
  return loadFromStorage<WeeklyGoal[]>(STORAGE_KEYS.WEEKLY_GOALS, []);
}

export function saveStoredWeeklyGoals(goals: WeeklyGoal[]): void {
  saveToStorage(STORAGE_KEYS.WEEKLY_GOALS, goals);
}

export function getStoredTimeLogs(): TimeLog[] {
  return loadFromStorage<TimeLog[]>(STORAGE_KEYS.TIME_LOGS, []);
}

export function saveStoredTimeLogs(logs: TimeLog[]): void {
  saveToStorage(STORAGE_KEYS.TIME_LOGS, logs);
}

export function getStoredNotes(): SecondBrainNote[] {
  return loadFromStorage<SecondBrainNote[]>(STORAGE_KEYS.NOTES, []);
}

export function saveStoredNotes(notes: SecondBrainNote[]): void {
  saveToStorage(STORAGE_KEYS.NOTES, notes);
}

export function getStoredLinks(): LinkRelation[] {
  return loadFromStorage<LinkRelation[]>(STORAGE_KEYS.LINKS, []);
}

export function saveStoredLinks(links: LinkRelation[]): void {
  saveToStorage(STORAGE_KEYS.LINKS, links);
}

export function clearAllLocalData(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEYS.TASKS);
  localStorage.removeItem(STORAGE_KEYS.MEETINGS);
  localStorage.removeItem(STORAGE_KEYS.PROJECTS);
  localStorage.removeItem(STORAGE_KEYS.INCOMES);
  localStorage.removeItem(STORAGE_KEYS.EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.WEEKLY_GOALS);
  localStorage.removeItem(STORAGE_KEYS.TIME_LOGS);
  localStorage.removeItem(STORAGE_KEYS.NOTES);
  localStorage.removeItem(STORAGE_KEYS.LINKS);
}

// Backup & Export Helpers
export function exportAllDataJSON(): string {
  const data = {
    version: '3.0',
    exportedAt: new Date().toISOString(),
    tasks: getStoredTasks(),
    meetings: getStoredMeetings(),
    projects: getStoredProjects(),
    incomes: getStoredIncomes(),
    expenses: getStoredExpenses(),
    weeklyGoals: getStoredWeeklyGoals(),
  };
  return JSON.stringify(data, null, 2);
}

export function exportAllDataCSV(): string {
  const tasks = getStoredTasks();
  const meetings = getStoredMeetings();
  const projects = getStoredProjects();
  const incomes = getStoredIncomes();
  const expenses = getStoredExpenses();
  const weeklyGoals = getStoredWeeklyGoals();

  let csv = '--- AGENDA: TAREAS ---\n';
  csv += 'ID,Titulo,Fecha,Hora,Completada,Proyecto\n';
  tasks.forEach(t => {
    csv += `"${t.id}","${t.title.replace(/"/g, '""')}","${t.date}","${t.time || ''}","${t.completed ? 'SI' : 'NO'}","${t.projectName || ''}"\n`;
  });

  csv += '\n--- AGENDA: REUNIONES ---\n';
  csv += 'ID,Titulo/Cliente,Fecha,Hora,Notas,Realizada,Proyecto\n';
  meetings.forEach(m => {
    csv += `"${m.id}","${m.title.replace(/"/g, '""')}","${m.date}","${m.time || ''}","${(m.notes || '').replace(/"/g, '""')}","${m.completed ? 'SI' : 'NO'}","${m.projectName || ''}"\n`;
  });

  csv += '\n--- OBJETIVOS SEMANALES ---\n';
  csv += 'ID,Titulo,Categoria,Semana,Completado\n';
  weeklyGoals.forEach(g => {
    csv += `"${g.id}","${g.title.replace(/"/g, '""')}","${g.category}","${g.weekStart}","${g.completed ? 'SI' : 'NO'}"\n`;
  });

  csv += '\n--- PROYECTOS ---\n';
  csv += 'ID,Cliente,Estado,Archivado,Notas\n';
  projects.forEach(p => {
    csv += `"${p.id}","${p.clientName.replace(/"/g, '""')}","${p.status}","${p.archived ? 'SI' : 'NO'}","${p.notes.replace(/"/g, '""')}"\n`;
  });

  csv += '\n--- INGRESOS ---\n';
  csv += 'ID,Concepto,Mes,Fecha,Monto,Moneda,Estado,Proyecto\n';
  incomes.forEach(i => {
    csv += `"${i.id}","${i.title.replace(/"/g, '""')}","${i.month}","${i.date}","${i.amount}","${i.currency}","${i.status}","${i.projectName || ''}"\n`;
  });

  csv += '\n--- GASTOS Y EGRESOS ---\n';
  csv += 'ID,Concepto,Categoria,Mes,Fecha,Monto,Moneda,Estado,Proyecto\n';
  expenses.forEach(e => {
    csv += `"${e.id}","${e.title.replace(/"/g, '""')}","${e.category}","${e.month}","${e.date}","${e.amount}","${e.currency}","${e.status}","${e.projectName || ''}"\n`;
  });

  return csv;
}

// Privacy mode (mask financial amounts in public places)
const PRIVACY_MODE_KEY = 'cero_crm_privacy_mode';

export function getPrivacyMode(): boolean {
  try {
    return localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPrivacyMode(enabled: boolean): void {
  try {
    localStorage.setItem(PRIVACY_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

// Unique device identification to avoid self-echoes during real-time sync
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem('cero_crm_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('cero_crm_device_id', id);
    }
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 11);
  }
}

// Personal Finance Local Storage Fallbacks
export function loadStoredPersonalAccounts(): PersonalAccount[] {
  return loadFromStorage<PersonalAccount[]>(STORAGE_KEYS.PERSONAL_ACCOUNTS, []);
}
export function saveStoredPersonalAccounts(accounts: PersonalAccount[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_ACCOUNTS, accounts);
}

export function loadStoredPersonalCategories(): PersonalCategory[] {
  return loadFromStorage<PersonalCategory[]>(STORAGE_KEYS.PERSONAL_CATEGORIES, []);
}
export function saveStoredPersonalCategories(categories: PersonalCategory[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_CATEGORIES, categories);
}

export function loadStoredPersonalTransactions(): PersonalTransaction[] {
  return loadFromStorage<PersonalTransaction[]>(STORAGE_KEYS.PERSONAL_TRANSACTIONS, []);
}
export function saveStoredPersonalTransactions(transactions: PersonalTransaction[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_TRANSACTIONS, transactions);
}

export function loadStoredPersonalRecurrings(): PersonalRecurring[] {
  return loadFromStorage<PersonalRecurring[]>(STORAGE_KEYS.PERSONAL_RECURRINGS, []);
}
export function saveStoredPersonalRecurrings(recurrings: PersonalRecurring[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_RECURRINGS, recurrings);
}

export function loadStoredPersonalBudgets(): PersonalBudget[] {
  return loadFromStorage<PersonalBudget[]>(STORAGE_KEYS.PERSONAL_BUDGETS, []);
}
export function saveStoredPersonalBudgets(budgets: PersonalBudget[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_BUDGETS, budgets);
}

export function loadStoredPersonalSavingsGoals(): SavingsGoal[] {
  return loadFromStorage<SavingsGoal[]>(STORAGE_KEYS.PERSONAL_SAVINGS_GOALS, []);
}
export function saveStoredPersonalSavingsGoals(goals: SavingsGoal[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_SAVINGS_GOALS, goals);
}

export function loadStoredPersonalStudyItems(): StudyItem[] {
  return loadFromStorage<StudyItem[]>(STORAGE_KEYS.PERSONAL_STUDY_ITEMS, []);
}
export function saveStoredPersonalStudyItems(items: StudyItem[]): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_STUDY_ITEMS, items);
}

export function loadStoredPersonalSettings(fallback: PersonalFinanceSettings): PersonalFinanceSettings {
  return loadFromStorage<PersonalFinanceSettings>(STORAGE_KEYS.PERSONAL_SETTINGS, fallback);
}
export function saveStoredPersonalSettings(settings: PersonalFinanceSettings): void {
  saveToStorage(STORAGE_KEYS.PERSONAL_SETTINGS, settings);
}

export const DEFAULT_STUDIO_PAYMENT_SETTINGS: StudioPaymentSettings = {
  accountHolder: '',
  aliasArs: '',
  cbuArs: '',
  aliasUsd: '',
  cbuUsd: '',
  paymentLink: '',
  usdtAddress: '',
};

export function loadStoredStudioPaymentSettings(fallback: StudioPaymentSettings = DEFAULT_STUDIO_PAYMENT_SETTINGS): StudioPaymentSettings {
  return loadFromStorage<StudioPaymentSettings>(STORAGE_KEYS.STUDIO_PAYMENT_SETTINGS, fallback);
}
export function saveStoredStudioPaymentSettings(settings: StudioPaymentSettings): void {
  saveToStorage(STORAGE_KEYS.STUDIO_PAYMENT_SETTINGS, settings);
}

// -------------------------------------------------------------
// MERCADO PAGO INBOX & CONCILIACIÓN DE PAGOS ENTRANTES
// -------------------------------------------------------------
export function loadStoredMercadoPagoPayments(): MercadoPagoIncomingPayment[] {
  return loadFromStorage<MercadoPagoIncomingPayment[]>(STORAGE_KEYS.MERCADOPAGO_PAYMENTS, []);
}

export function saveStoredMercadoPagoPayments(payments: MercadoPagoIncomingPayment[]): void {
  saveToStorage(STORAGE_KEYS.MERCADOPAGO_PAYMENTS, payments);
}

export function addStoredMercadoPagoPayment(payment: MercadoPagoIncomingPayment): MercadoPagoIncomingPayment[] {
  const current = loadStoredMercadoPagoPayments();
  const exists = current.some(p => p.id === payment.id || (p.mpPaymentId && p.mpPaymentId === payment.mpPaymentId));
  const updated = exists ? current.map(p => (p.id === payment.id || p.mpPaymentId === payment.mpPaymentId) ? payment : p) : [payment, ...current];
  saveStoredMercadoPagoPayments(updated);
  return updated;
}

// -------------------------------------------------------------
// PAPELERA DE RECICLAJE (Soft-Delete con 30 días de retención)
// -------------------------------------------------------------
export function loadStoredTrash(): TrashItem[] {
  const items = loadFromStorage<TrashItem[]>(STORAGE_KEYS.TRASH, []);
  // Auto-purge expired items (> 30 days)
  const now = new Date().toISOString();
  const valid = items.filter(i => !i.expiresAt || i.expiresAt > now);
  if (valid.length !== items.length) {
    saveToStorage(STORAGE_KEYS.TRASH, valid);
  }
  return valid;
}

export function saveStoredTrash(items: TrashItem[]): void {
  saveToStorage(STORAGE_KEYS.TRASH, items);
}

export function addTrashRecord(item: Omit<TrashItem, 'deletedAt' | 'expiresAt'>): TrashItem {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fullItem: TrashItem = {
    ...item,
    deletedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  const current = loadStoredTrash();
  const updated = [fullItem, ...current.filter(i => i.id !== fullItem.id)];
  saveStoredTrash(updated);
  return fullItem;
}

export function purgeTrashRecord(id: string): void {
  const current = loadStoredTrash();
  saveStoredTrash(current.filter(i => i.id !== id));
}

export function emptyTrashRecords(): void {
  saveStoredTrash([]);
}

export const DEFAULT_STUDIO_FIXED_EXPENSES: StudioFixedExpense[] = [
  {
    id: 'sfe_hostinger',
    name: 'Hostinger Cloud / Web Hosting',
    provider: 'Hostinger',
    category: 'hosting',
    amount: 96,
    currency: 'USD',
    billingCycle: 'anual',
    nextDueDate: '2027-02-15',
    lastPaidDate: '2026-02-15',
    autoRenew: true,
    notes: 'Hosting anual del estudio para webs de clientes y proyectos propios. Al vencer renueva por 1 año.',
    active: true,
    paymentMethod: 'Tarjeta de Crédito',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sfe_chatgpt',
    name: 'ChatGPT Plus (OpenAI)',
    provider: 'OpenAI',
    category: 'ia',
    amount: 20,
    currency: 'USD',
    billingCycle: 'mensual',
    nextDueDate: '2026-10-18',
    lastPaidDate: '2026-09-18',
    autoRenew: true,
    notes: 'Suscripción IA mensual para redacción, ideas y asistencia técnica',
    active: true,
    paymentMethod: 'Tarjeta',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sfe_cursor',
    name: 'Cursor AI Pro',
    provider: 'Cursor',
    category: 'ia',
    amount: 20,
    currency: 'USD',
    billingCycle: 'mensual',
    nextDueDate: '2026-10-25',
    lastPaidDate: '2026-09-25',
    autoRenew: true,
    notes: 'Editor de código IA mensual para proyectos web',
    active: true,
    paymentMethod: 'Tarjeta',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sfe_dominio_estudio',
    name: 'Dominio Principal Estudio (.com.ar)',
    provider: 'Nic.ar',
    category: 'dominios',
    amount: 8500,
    currency: 'ARS',
    billingCycle: 'anual',
    nextDueDate: '2026-11-20',
    lastPaidDate: '2025-11-20',
    autoRenew: false,
    notes: 'Dominio oficial en Nic.ar. Renovación manual anual.',
    active: true,
    paymentMethod: 'Mercado Pago / Tarjeta',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sfe_dominio_cliente',
    name: 'Dominio Cliente (ej: estudio-arq.com)',
    provider: 'Donweb / Namecheap',
    category: 'dominios',
    amount: 14000,
    currency: 'ARS',
    billingCycle: 'anual',
    nextDueDate: '2026-11-05',
    lastPaidDate: '2025-11-05',
    autoRenew: false,
    notes: 'Dominio a nombre del estudio que se renueva y se le refactura al cliente.',
    active: true,
    paymentMethod: 'Transferencia',
    createdAt: new Date().toISOString(),
  },
];

export function loadStoredStudioFixedExpenses(): StudioFixedExpense[] {
  const loaded = loadFromStorage<StudioFixedExpense[]>(STORAGE_KEYS.STUDIO_FIXED_EXPENSES, []);
  if (!loaded || loaded.length === 0) {
    saveToStorage(STORAGE_KEYS.STUDIO_FIXED_EXPENSES, DEFAULT_STUDIO_FIXED_EXPENSES);
    return DEFAULT_STUDIO_FIXED_EXPENSES;
  }
  return loaded;
}

export function saveStoredStudioFixedExpenses(items: StudioFixedExpense[]): void {
  saveToStorage(STORAGE_KEYS.STUDIO_FIXED_EXPENSES, items);
}


