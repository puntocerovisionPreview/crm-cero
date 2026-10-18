import React, { ViewTransition, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ViewTab, AgendaTask, AgendaMeeting, Project, IncomeRecord, ExpenseRecord, SyncStatus, SubTask, SubtareaFoco, WeeklyGoal, WeeklyMission, TimeLog, SecondBrainNote, PersonalAccount, PersonalCategory, PersonalTransaction, PersonalRecurring, PersonalBudget, SavingsGoal, StudyItem, PersonalFinanceSettings, Payment, StudioPaymentSettings, TrashItem, StudioFixedExpense, Client, MercadoPagoIncomingPayment } from './types';
import { 
  getStoredTasks, 
  saveStoredTasks, 
  getStoredMeetings, 
  saveStoredMeetings, 
  getStoredProjects, 
  saveStoredProjects, 
  getStoredIncomes, 
  saveStoredIncomes, 
  getStoredExpenses,
  saveStoredExpenses,
  getStoredWeeklyGoals,
  saveStoredWeeklyGoals,
  getStoredTimeLogs,
  saveStoredTimeLogs,
  getStoredNotes,
  saveStoredNotes,
  getWeekMonday,
  getTodayString,
  addDays,
  exportAllDataJSON,
  exportAllDataCSV,
  getStoredAuthToken,
  saveStoredAuthToken,
  removeStoredAuthToken,
  clearAllLocalData,
  loadStoredPersonalAccounts,
  saveStoredPersonalAccounts,
  loadStoredPersonalCategories,
  saveStoredPersonalCategories,
  loadStoredPersonalTransactions,
  saveStoredPersonalTransactions,
  loadStoredPersonalRecurrings,
  saveStoredPersonalRecurrings,
  loadStoredPersonalBudgets,
  saveStoredPersonalBudgets,
  loadStoredPersonalSavingsGoals,
  saveStoredPersonalSavingsGoals,
  loadStoredPersonalStudyItems,
  saveStoredPersonalStudyItems,
  loadStoredPersonalSettings,
  saveStoredPersonalSettings,
  loadStoredStudioPaymentSettings,
  saveStoredStudioPaymentSettings,
  loadStoredStudioFixedExpenses,
  saveStoredStudioFixedExpenses,
  loadStoredTrash,
  addTrashRecord,
  purgeTrashRecord
} from './utils/storage';
import {
  isSoundEnabled,
  toggleSound,
  playTaskDone,
  playSubtaskDone,
  playSubtaskToggle,
  playItemCreated,
  playItemDeleted,
  playPostpone,
  playAllDone,
  playPaymentReceived
} from './utils/sound';
import { hapticFeedback } from './utils/haptics';
import {
  subscribeTasks,
  saveTaskToFirestore,
  updateTaskInFirestore,
  deleteTaskFromFirestore,
  subscribeMeetings,
  saveMeetingToFirestore,
  updateMeetingInFirestore,
  deleteMeetingFromFirestore,
  subscribeProjects,
  saveProjectToFirestore,
  updateProjectInFirestore,
  deleteProjectFromFirestore,
  subscribeIncomes,
  saveIncomeToFirestore,
  updateIncomeInFirestore,
  deleteIncomeFromFirestore,
  subscribeExpenses,
  saveExpenseToFirestore,
  updateExpenseInFirestore,
  deleteExpenseFromFirestore,
  subscribeWeeklyGoals,
  saveWeeklyGoalToFirestore,
  updateWeeklyGoalInFirestore,
  deleteWeeklyGoalFromFirestore,
  subscribeNotes,
  saveNoteToFirestore,
  updateNoteInFirestore,
  deleteNoteFromFirestore,
  subscribePersonalAccounts,
  savePersonalAccountToFirestore,
  updatePersonalAccountInFirestore,
  subscribePersonalCategories,
  savePersonalCategoryToFirestore,
  updatePersonalCategoryInFirestore,
  subscribePersonalTransactions,
  savePersonalTransactionToFirestore,
  updatePersonalTransactionInFirestore,
  deletePersonalTransactionFromFirestore,
  subscribePersonalRecurrings,
  savePersonalRecurringToFirestore,
  updatePersonalRecurringInFirestore,
  deletePersonalRecurringFromFirestore,
  subscribePersonalBudgets,
  savePersonalBudgetToFirestore,
  updatePersonalBudgetInFirestore,
  deletePersonalBudgetFromFirestore,
  subscribePersonalSavingsGoals,
  savePersonalSavingsGoalToFirestore,
  updatePersonalSavingsGoalInFirestore,
  deletePersonalSavingsGoalFromFirestore,
  subscribePersonalStudyItems,
  savePersonalStudyItemToFirestore,
  updatePersonalStudyItemInFirestore,
  deletePersonalStudyItemFromFirestore,
  subscribePersonalFinanceSettings,
  savePersonalFinanceSettingsToFirestore,
  subscribeStudioFixedExpenses,
  saveStudioFixedExpenseToFirestore,
  updateStudioFixedExpenseInFirestore,
  deleteStudioFixedExpenseFromFirestore,
  seedPersonalFinanceDefaultsIfEmpty,
  resetAllFirestoreData,
  subscribeClients,
  subscribeMpIncoming,
  markMpIncomingReconciled,
  saveClientToFirestore,
  applyClientLinks,
  exportCompleteCrmBackup,
  importCompleteCrmBackup,
  seedLocalDataToFirestoreIfEmpty,
  syncLocalDataWithFirestore
} from './utils/firestoreService';
import { subscribePafPricing, saveStoredPafPricingSettings } from './utils/pafPricingConfig';
import { showSystemNotification } from './utils/notifications';
import { DEFAULT_PERSONAL_SETTINGS, DEFAULT_PERSONAL_ACCOUNTS, DEFAULT_PERSONAL_CATEGORIES, calculateNextRecurringDate } from './utils/personalFinance';

// Layout Components
import { DesktopSidebar } from './components/DesktopSidebar';
import { AppTopBar } from './components/AppTopBar';
import { MobileNav } from './components/MobileNav';
import { QuickAddModal, QuickAddType } from './components/QuickAddModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AuthScreen } from './components/AuthScreen';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseAuth';
import { isAllowedUser, signOutUser } from './utils/authAccess';
import { buildStudentPortalSnapshot, portalSnapshotKey, publishStudentPortal, unpublishStudentPortal } from './utils/studentPortal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { PomodoroModal } from './components/PomodoroModal';
import { PafGuideModal } from './components/PafGuideModal';
import { PafPricingConfigModal } from './components/PafPricingConfigModal';
import { RepairTaskLinksModal } from './components/RepairTaskLinksModal';
import { StudioPaymentSettingsModal } from './components/StudioPaymentSettingsModal';
import { RegisterPaymentModal } from './components/RegisterPaymentModal';
import { resolveTaskProject } from './utils/taskProject';
import { getProjectPayments } from './utils/paymentPlans';
import { Sparkles } from 'lucide-react';

// Views & Sub-pages
import { AgendaView } from './views/AgendaView';
import { migrateGoalsToMissions } from './utils/missions';
import { useRouter } from './utils/router';

// Personal Finance Views
import { useUsdRates, resolveUsdRate } from './utils/currency';
import { planClientLinks } from './utils/clients';
import { MercadoPagoInbox } from './components/MercadoPagoInbox';
import { MercadoPagoReconcileModal } from './components/MercadoPagoReconcileModal';
import { MercadoPagoPaymentAlert } from './components/MercadoPagoPaymentAlert';

// Lazy load Knowledge Graph module to preserve fast app bundle boot per spec
function RouteLoading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <span className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent)] animate-spin" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

const KnowledgeGraphView = React.lazy(() => import('./views/KnowledgeGraphView'));
const HomeView = React.lazy(() => import('./views/HomeView'));
// Pantallas que se descargan recién cuando las abrís (antes todo venía en un archivo de 3 MB).
// Hoy/Agenda se carga de entrada porque es la primera pantalla.
const CalendarView = React.lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })));
const ProjectsSimpleView = React.lazy(() => import('./views/ProjectsSimpleView').then((m) => ({ default: m.ProjectsSimpleView })));
const IncomeView = React.lazy(() => import('./views/IncomeView').then((m) => ({ default: m.IncomeView })));
const ClientDetailView = React.lazy(() => import('./views/ClientDetailView').then((m) => ({ default: m.ClientDetailView })));
const NewClientWizardView = React.lazy(() => import('./views/NewClientWizardView').then((m) => ({ default: m.NewClientWizardView })));
const TaskDetailView = React.lazy(() => import('./views/TaskDetailView').then((m) => ({ default: m.TaskDetailView })));
const AyudaView = React.lazy(() => import('./views/AyudaView').then((m) => ({ default: m.AyudaView })));
const SecondBrainView = React.lazy(() => import('./views/SecondBrainView').then((m) => ({ default: m.SecondBrainView })));
const NotesView = React.lazy(() => import('./views/NotesView').then((m) => ({ default: m.NotesView })));
const FocusView = React.lazy(() => import('./views/FocusView').then((m) => ({ default: m.FocusView })));
const HorizonView = React.lazy(() => import('./views/HorizonView').then((m) => ({ default: m.HorizonView })));
const DineroUnifiedView = React.lazy(() => import('./views/DineroUnifiedView').then((m) => ({ default: m.DineroUnifiedView })));
const StudioFixedExpensesSection = React.lazy(() => import('./components/StudioFixedExpensesSection').then((m) => ({ default: m.StudioFixedExpensesSection })));
const CerebroUnifiedView = React.lazy(() => import('./views/CerebroUnifiedView').then((m) => ({ default: m.CerebroUnifiedView })));
const AjustesView = React.lazy(() => import('./views/AjustesView').then((m) => ({ default: m.AjustesView })));
const NewPaymentView = React.lazy(() => import('./views/NewPaymentView').then((m) => ({ default: m.NewPaymentView })));
const AgreementEditorView = React.lazy(() => import('./views/AgreementEditorView').then((m) => ({ default: m.AgreementEditorView })));
const SemanaView = React.lazy(() => import('./views/SemanaView').then((m) => ({ default: m.SemanaView })));
const PersonalFinanceLayout = React.lazy(() => import('./views/personal-finance/PersonalFinanceLayout').then((m) => ({ default: m.PersonalFinanceLayout })));
const PersonalFinanceOverviewView = React.lazy(() => import('./views/personal-finance/PersonalFinanceOverviewView').then((m) => ({ default: m.PersonalFinanceOverviewView })));
const PersonalFinanceQuickAddView = React.lazy(() => import('./views/personal-finance/PersonalFinanceQuickAddView').then((m) => ({ default: m.PersonalFinanceQuickAddView })));
const PersonalFinanceTransactionsView = React.lazy(() => import('./views/personal-finance/PersonalFinanceTransactionsView').then((m) => ({ default: m.PersonalFinanceTransactionsView })));
const PersonalFinanceAccountsView = React.lazy(() => import('./views/personal-finance/PersonalFinanceAccountsView').then((m) => ({ default: m.PersonalFinanceAccountsView })));
const PersonalFinanceBudgetsView = React.lazy(() => import('./views/personal-finance/PersonalFinanceBudgetsView').then((m) => ({ default: m.PersonalFinanceBudgetsView })));
const PersonalFinanceGoalsView = React.lazy(() => import('./views/personal-finance/PersonalFinanceGoalsView').then((m) => ({ default: m.PersonalFinanceGoalsView })));
const PersonalFinanceStudyView = React.lazy(() => import('./views/personal-finance/PersonalFinanceStudyView').then((m) => ({ default: m.PersonalFinanceStudyView })));
const PersonalFinanceRecurringView = React.lazy(() => import('./views/personal-finance/PersonalFinanceRecurringView').then((m) => ({ default: m.PersonalFinanceRecurringView })));
const PersonalFinanceSettingsView = React.lazy(() => import('./views/personal-finance/PersonalFinanceSettingsView').then((m) => ({ default: m.PersonalFinanceSettingsView })));
const ProspectingView = React.lazy(() => import('./views/ProspectingView').then((m) => ({ default: m.ProspectingView })));
const GeminiCopilotDrawer = React.lazy(() => import('./components/GeminiCopilotDrawer').then((m) => ({ default: m.GeminiCopilotDrawer })));
const IosWidgetsModal = React.lazy(() => import('./components/IosWidgetsModal').then((m) => ({ default: m.IosWidgetsModal })));


export default function App() {
  // Path-based SPA Router (syncs with window.location & browser history)
  const { currentRoute, navigate, goBack } = useRouter();

  // Sesión real de Firebase (Google). authToken = uid de una cuenta autorizada.
  // Antes era un PIN guardado en el navegador que no protegía los datos.
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  useEffect(() => {
    removeStoredAuthToken();
    return onAuthStateChanged(auth, (user) => {
      if (user && isAllowedUser(user)) {
        setAuthToken(user.uid);
        setDeniedEmail(null);
      } else {
        setAuthToken(null);
        setDeniedEmail(user?.email || null);
      }
      setAuthReady(true);
    });
  }, []);

  // Cloud Sync Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Toast Notification state with Undo support
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, onUndo?: () => void) => {
    setToast({ message: msg, onUndo });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, onUndo ? 5000 : 2500);
  }, []);

  // Theme State: Default to Dark Mode (.CERO dark aesthetic), supports full Light Mode switch
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('cero_theme') as 'dark' | 'light';
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.body.classList.remove('dark');
        document.body.classList.add('light');
      }
      document.getElementById('theme-color')?.setAttribute('content', theme === 'dark' ? '#000000' : '#F2F2F7');
      localStorage.setItem('cero_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    hapticFeedback.light();
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      showToast(next === 'light' ? 'Modo claro activado' : 'Modo oscuro activado');
      return next;
    });
  };

  // Sound Feedback State
  const [soundActive, setSoundActive] = useState<boolean>(() => isSoundEnabled());

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundActive(next);
    showToast(next ? 'Sonidos activados' : 'Sonidos desactivados');
  };

  // Privacy Mode ($ ••••••)
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cero_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleTogglePrivacy = () => {
    setPrivacyMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cero_privacy_mode', String(next));
      } catch {}
      showToast(next ? 'Modo privacidad activado' : 'Modo privacidad desactivado');
      return next;
    });
  };

  // Persistent States (cached from localStorage for immediate render)
  const [tasks, setTasks] = useState<AgendaTask[]>(() => getStoredTasks());
  const [meetings, setMeetings] = useState<AgendaMeeting[]>(() => getStoredMeetings());
  const [projects, setProjects] = useState<Project[]>(() => getStoredProjects());
  // Pagos que entraron por Mercado Pago (los guarda el servidor) y el que se está registrando
  const [mpIncoming, setMpIncoming] = useState<MercadoPagoIncomingPayment[]>([]);
  const [mpToRegister, setMpToRegister] = useState<MercadoPagoIncomingPayment | null>(null);
  // Clientes (agrupan proyectos). Se vinculan solos cuando proyectos y clientes llegan de la nube.
  const [clients, setClients] = useState<Client[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState({ projects: false, clients: false });
  const [incomes, setIncomes] = useState<IncomeRecord[]>(() => getStoredIncomes());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => getStoredExpenses());
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyMission[]>(() => {
    const loaded = getStoredWeeklyGoals();
    return migrateGoalsToMissions(loaded);
  });
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(() => getStoredTimeLogs());
  const [notes, setNotes] = useState<SecondBrainNote[]>(() => getStoredNotes());

  // Personal Finance Persistent States
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccount[]>(() => {
    const loaded = loadStoredPersonalAccounts();
    if (loaded && loaded.length > 0) return loaded;
    const seeded = DEFAULT_PERSONAL_ACCOUNTS.map((a, i) => ({
      ...a,
      id: a.id || `acc_${i + 1}`,
      createdAt: new Date().toISOString(),
    })) as PersonalAccount[];
    saveStoredPersonalAccounts(seeded);
    return seeded;
  });
  const [personalCategories, setPersonalCategories] = useState<PersonalCategory[]>(() => {
    const loaded = loadStoredPersonalCategories();
    if (loaded && loaded.length > 0) return loaded;
    const seeded = DEFAULT_PERSONAL_CATEGORIES.map((c, i) => ({
      ...c,
      id: c.id || `cat_${i + 1}`,
      createdAt: new Date().toISOString(),
    })) as PersonalCategory[];
    saveStoredPersonalCategories(seeded);
    return seeded;
  });
  const [personalTransactions, setPersonalTransactions] = useState<PersonalTransaction[]>(() => loadStoredPersonalTransactions());
  const [personalRecurrings, setPersonalRecurrings] = useState<PersonalRecurring[]>(() => loadStoredPersonalRecurrings());
  const [personalBudgets, setPersonalBudgets] = useState<PersonalBudget[]>(() => loadStoredPersonalBudgets());
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => loadStoredPersonalSavingsGoals());
  const [studyItems, setStudyItems] = useState<StudyItem[]>(() => loadStoredPersonalStudyItems());
  const [personalFinanceSettings, setPersonalFinanceSettings] = useState<PersonalFinanceSettings>(() => loadStoredPersonalSettings(DEFAULT_PERSONAL_SETTINGS));

  // Studio Fixed Expenses (Dominios, IAs, Hosting, Software y Vencimientos)
  const [studioFixedExpenses, setStudioFixedExpenses] = useState<StudioFixedExpense[]>(() => loadStoredStudioFixedExpenses());

  // Studio Payment Settings (CBU/Alias/Link)
  const [studioPaymentSettings, setStudioPaymentSettings] = useState<StudioPaymentSettings>(() => loadStoredStudioPaymentSettings());
  const [showStudioPaymentSettingsModal, setShowStudioPaymentSettingsModal] = useState(false);

  const handleSaveStudioPaymentSettings = (settings: StudioPaymentSettings) => {
    setStudioPaymentSettings(settings);
    saveStoredStudioPaymentSettings(settings);
    showToast('Datos de cobro guardados con éxito');
  };

  // Personal Finance Handlers
  const handleSavePersonalTransaction = async (data: Omit<PersonalTransaction, 'id' | 'createdAt'>) => {
    const newTx: PersonalTransaction = {
      ...data,
      id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setPersonalTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredPersonalTransactions(updated);
      return updated;
    });
    try {
      await savePersonalTransactionToFirestore(newTx);
    } catch (err) {
      console.warn('Error saving personal transaction to firestore:', err);
    }
    showToast('Movimiento registrado');
  };

  const handleUpdatePersonalTransaction = async (id: string, updates: Partial<PersonalTransaction>) => {
    setPersonalTransactions(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      saveStoredPersonalTransactions(updated);
      return updated;
    });
    try {
      await updatePersonalTransactionInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating personal transaction in firestore:', err);
    }
    showToast('Movimiento actualizado');
  };

  const handleDeletePersonalTransaction = async (id: string) => {
    const txToDelete = personalTransactions.find(t => t.id === id);
    if (txToDelete) {
      addTrashRecord({
        id: txToDelete.id,
        itemType: 'movimiento_personal',
        title: txToDelete.note || 'Movimiento personal',
        subtitle: txToDelete.date,
        amount: txToDelete.amount,
        currency: txToDelete.currency,
        data: txToDelete,
      });
    }
    setPersonalTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveStoredPersonalTransactions(updated);
      return updated;
    });
    try {
      await deletePersonalTransactionFromFirestore(id);
      showToast('Movimiento enviado a la papelera', () => {
        if (txToDelete) {
          handleSavePersonalTransaction(txToDelete);
          purgeTrashRecord(txToDelete.id);
        }
      });
    } catch (err) {
      console.warn('Error deleting personal transaction from firestore:', err);
    }
  };

  const handleSavePersonalAccount = async (account: PersonalAccount) => {
    setPersonalAccounts(prev => {
      const exists = prev.some(a => a.id === account.id);
      const updated = exists ? prev.map(a => a.id === account.id ? account : a) : [...prev, account];
      saveStoredPersonalAccounts(updated);
      return updated;
    });
    try {
      await savePersonalAccountToFirestore(account);
    } catch (err) {
      console.warn('Error saving personal account to firestore:', err);
    }
    showToast('Cuenta guardada');
  };

  const handleUpdatePersonalAccount = async (id: string, updates: Partial<PersonalAccount>) => {
    setPersonalAccounts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      saveStoredPersonalAccounts(updated);
      return updated;
    });
    try {
      await updatePersonalAccountInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating personal account in firestore:', err);
    }
    showToast('Cuenta actualizada');
  };

  const handleDeletePersonalAccount = async (id: string, permanent: boolean = false) => {
    const accToDelete = personalAccounts.find(a => a.id === id);
    if (permanent) {
      if (accToDelete) {
        addTrashRecord({
          id: accToDelete.id,
          itemType: 'movimiento_personal' as any,
          title: `Cuenta: ${accToDelete.name}`,
          subtitle: `${accToDelete.currency}`,
          data: accToDelete,
        });
      }
      setPersonalAccounts(prev => {
        const updated = prev.filter(a => a.id !== id);
        saveStoredPersonalAccounts(updated);
        return updated;
      });
      playItemDeleted();
      showToast('Cuenta eliminada', () => {
        if (accToDelete) {
          handleSavePersonalAccount(accToDelete);
        }
      });
    } else {
      await handleUpdatePersonalAccount(id, { archived: true });
      showToast('Cuenta archivada');
    }
  };

  const handleSavePersonalBudget = async (budget: PersonalBudget) => {
    setPersonalBudgets(prev => {
      const exists = prev.some(b => b.id === budget.id);
      const updated = exists ? prev.map(b => b.id === budget.id ? budget : b) : [...prev, budget];
      saveStoredPersonalBudgets(updated);
      return updated;
    });
    try {
      await savePersonalBudgetToFirestore(budget);
    } catch (err) {
      console.warn('Error saving personal budget to firestore:', err);
    }
    showToast('Presupuesto guardado');
  };

  const handleUpdatePersonalBudget = async (id: string, updates: Partial<PersonalBudget>) => {
    setPersonalBudgets(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      saveStoredPersonalBudgets(updated);
      return updated;
    });
    try {
      await updatePersonalBudgetInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating personal budget in firestore:', err);
    }
    showToast('Presupuesto actualizado');
  };

  const handleDeletePersonalBudget = async (id: string) => {
    setPersonalBudgets(prev => {
      const updated = prev.filter(b => b.id !== id);
      saveStoredPersonalBudgets(updated);
      return updated;
    });
    try {
      await deletePersonalBudgetFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting personal budget from firestore:', err);
    }
    showToast('Presupuesto eliminado');
  };

  const handleSaveSavingsGoal = async (goal: SavingsGoal) => {
    setSavingsGoals(prev => {
      const exists = prev.some(g => g.id === goal.id);
      const updated = exists ? prev.map(g => g.id === goal.id ? goal : g) : [...prev, goal];
      saveStoredPersonalSavingsGoals(updated);
      return updated;
    });
    try {
      await savePersonalSavingsGoalToFirestore(goal);
    } catch (err) {
      console.warn('Error saving savings goal to firestore:', err);
    }
    showToast('Meta guardada');
  };

  const handleUpdateSavingsGoal = async (id: string, updates: Partial<SavingsGoal>) => {
    setSavingsGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, ...updates } : g);
      saveStoredPersonalSavingsGoals(updated);
      return updated;
    });
    try {
      await updatePersonalSavingsGoalInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating savings goal in firestore:', err);
    }
    showToast('Meta actualizada');
  };

  const handleDeleteSavingsGoal = async (id: string) => {
    setSavingsGoals(prev => {
      const updated = prev.filter(g => g.id !== id);
      saveStoredPersonalSavingsGoals(updated);
      return updated;
    });
    try {
      await deletePersonalSavingsGoalFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting savings goal from firestore:', err);
    }
    showToast('Meta eliminada');
  };

  const handleSaveStudyItem = async (data: Omit<StudyItem, 'id' | 'createdAt'>) => {
    const newItem: StudyItem = {
      ...data,
      id: `study_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setStudyItems(prev => {
      const updated = [newItem, ...prev];
      saveStoredPersonalStudyItems(updated);
      return updated;
    });
    try {
      await savePersonalStudyItemToFirestore(newItem);
    } catch (err) {
      console.warn('Error saving study item to firestore:', err);
    }
    showToast('Ítem de estudio guardado');
  };

  const handleUpdateStudyItem = async (id: string, updates: Partial<StudyItem>) => {
    setStudyItems(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      saveStoredPersonalStudyItems(updated);
      return updated;
    });
    try {
      await updatePersonalStudyItemInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating study item in firestore:', err);
    }
    showToast('Ítem de estudio actualizado');
  };

  const handleDeleteStudyItem = async (id: string) => {
    setStudyItems(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveStoredPersonalStudyItems(updated);
      return updated;
    });
    try {
      await deletePersonalStudyItemFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting study item from firestore:', err);
    }
    showToast('Ítem de estudio eliminado');
  };

  const handleSavePersonalRecurring = async (data: Omit<PersonalRecurring, 'id' | 'createdAt'>) => {
    const newRec: PersonalRecurring = {
      ...data,
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setPersonalRecurrings(prev => {
      const updated = [newRec, ...prev];
      saveStoredPersonalRecurrings(updated);
      return updated;
    });
    try {
      await savePersonalRecurringToFirestore(newRec);
    } catch (err) {
      console.warn('Error saving recurring to firestore:', err);
    }
    showToast('Suscripción recurrente guardada');
  };

  const handleUpdatePersonalRecurring = async (id: string, updates: Partial<PersonalRecurring>) => {
    setPersonalRecurrings(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      saveStoredPersonalRecurrings(updated);
      return updated;
    });
    try {
      await updatePersonalRecurringInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating recurring in firestore:', err);
    }
    showToast('Suscripción actualizada');
  };

  const handleDeletePersonalRecurring = async (id: string) => {
    setPersonalRecurrings(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveStoredPersonalRecurrings(updated);
      return updated;
    });
    try {
      await deletePersonalRecurringFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting recurring from firestore:', err);
    }
    showToast('Suscripción eliminada');
  };

  const handleConfirmPersonalRecurring = async (rec: PersonalRecurring) => {
    const newTx: PersonalTransaction = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: rec.type,
      amount: rec.amount,
      currency: rec.currency,
      date: rec.nextDate,
      accountId: rec.accountId,
      categoryId: rec.categoryId,
      note: `Recurrente: ${rec.title}`,
      recurringId: rec.id,
      status: 'confirmado',
      createdAt: new Date().toISOString(),
    };
    setPersonalTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredPersonalTransactions(updated);
      return updated;
    });
    try {
      await savePersonalTransactionToFirestore(newTx);
    } catch (err) {
      console.warn('Error saving recurring tx to firestore:', err);
    }

    const nextDate = calculateNextRecurringDate(rec.nextDate, rec.frequency);
    await handleUpdatePersonalRecurring(rec.id, { nextDate });
    showToast(`Pago de ${rec.title} confirmado`);
  };

  // Combina con lo guardado: Ajustes manda cambios parciales y antes se perdía el resto
  const handleSavePersonalFinanceSettings = async (changes: Partial<PersonalFinanceSettings>) => {
    const newSettings: PersonalFinanceSettings = { ...personalFinanceSettings, ...changes };
    setPersonalFinanceSettings(newSettings);
    saveStoredPersonalSettings(newSettings);
    try {
      await savePersonalFinanceSettingsToFirestore(newSettings);
    } catch (err) {
      console.warn('Error saving personal finance settings to firestore:', err);
    }
    showToast('Ajustes de finanzas guardados');
  };

  // Studio Fixed Expenses Handlers
  const handleAddStudioFixedExpense = async (data: Omit<StudioFixedExpense, 'id' | 'createdAt'>) => {
    const newItem: StudioFixedExpense = {
      ...data,
      id: `sfe_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setStudioFixedExpenses(prev => {
      const updated = [newItem, ...prev];
      saveStoredStudioFixedExpenses(updated);
      return updated;
    });
    try {
      await saveStudioFixedExpenseToFirestore(newItem);
    } catch (err) {
      console.warn('Error saving studio fixed expense to firestore:', err);
    }
    showToast('Gasto fijo / servicio registrado con éxito');
  };

  const handleUpdateStudioFixedExpense = async (id: string, updates: Partial<StudioFixedExpense>) => {
    setStudioFixedExpenses(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      saveStoredStudioFixedExpenses(updated);
      return updated;
    });
    try {
      await updateStudioFixedExpenseInFirestore(id, updates);
    } catch (err) {
      console.warn('Error updating studio fixed expense in firestore:', err);
    }
    showToast('Gasto fijo actualizado');
  };

  const handleDeleteStudioFixedExpense = async (id: string) => {
    setStudioFixedExpenses(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveStoredStudioFixedExpenses(updated);
      return updated;
    });
    try {
      await deleteStudioFixedExpenseFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting studio fixed expense from firestore:', err);
    }
    showToast('Gasto fijo eliminado');
  };

  // Stable references to prevent reminder timer storm re-renders
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const meetingsRef = useRef(meetings);
  meetingsRef.current = meetings;
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Notes Handlers (Base de Conocimiento)
  const handleAddNote = (noteData: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: SecondBrainNote = {
      ...noteData,
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => {
      const updated = [newNote, ...prev];
      saveStoredNotes(updated);
      return updated;
    });
    saveNoteToFirestore(newNote).catch(err => console.warn('Error saving note to firestore:', err));
    showToast('Nota guardada');
  };

  const handleUpdateNote = (id: string, updates: Partial<SecondBrainNote>) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n);
      saveStoredNotes(updated);
      return updated;
    });
    updateNoteInFirestore(id, updates).catch(err => console.warn('Error updating note in firestore:', err));
  };

  const handleDeleteNote = (id: string) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (noteToDelete) {
      addTrashRecord({
        id: noteToDelete.id,
        itemType: 'nota',
        title: noteToDelete.title || 'Nota',
        subtitle: noteToDelete.date,
        data: noteToDelete,
      });
    }
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveStoredNotes(updated);
      return updated;
    });
    deleteNoteFromFirestore(id).catch(err => console.warn('Error deleting note from firestore:', err));
    showToast('Nota enviada a la papelera', () => {
      if (noteToDelete) {
        handleAddNote(noteToDelete);
        purgeTrashRecord(noteToDelete.id);
      }
    });
  };

  // Time Logs Handlers
  const handleAddTimeLog = (logData: Omit<TimeLog, 'id' | 'createdAt'>) => {
    const newLog: TimeLog = {
      ...logData,
      id: `timelog_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setTimeLogs(prev => {
      const updated = [newLog, ...prev];
      saveStoredTimeLogs(updated);
      return updated;
    });
    showToast('Tiempo registrado con éxito');
  };

  const handleDeleteTimeLog = (id: string) => {
    setTimeLogs(prev => {
      const updated = prev.filter(l => l.id !== id);
      saveStoredTimeLogs(updated);
      return updated;
    });
    showToast('Registro de tiempo eliminado');
  };

  // Focus & PAF Modal States
  const [showPomodoroModal, setShowPomodoroModal] = useState(false);
  const [showPafGuideModal, setShowPafGuideModal] = useState(false);
  const [showPafPricingModal, setShowPafPricingModal] = useState(false);
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showRepairLinksModal, setShowRepairLinksModal] = useState(false);
  const [showIosWidgetsModal, setShowIosWidgetsModal] = useState(false);

  // Deep-linking URL Actions for iOS Widgets, Shortcuts & PWA Quick Actions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const action = searchParams.get('action');
      if (!action) return;

      if (action === 'nueva-tarea' || action === 'tarea') {
        setQuickAddModal({
          isOpen: true,
          type: 'tarea',
          defaultDate: getTodayString(),
        });
      } else if (action === 'agenda-hoy' || action === 'agenda') {
        navigate('/agenda');
      } else if (action === 'modo-foco' || action === 'foco') {
        navigate('/foco');
      } else if (action === 'nuevo-ingreso' || action === 'ingreso') {
        setQuickAddModal({
          isOpen: true,
          type: 'ingreso',
          defaultDate: getTodayString(),
        });
      } else if (action === 'widgets-ios' || action === 'widgets' || action === 'iphone') {
        setShowIosWidgetsModal(true);
      } else if (action === 'copiloto') {
        setShowGeminiChat(true);
      }

      // Clean up URL query parameter without refreshing
      const newUrl = window.location.pathname + (window.location.hash || '');
      window.history.replaceState({}, '', newUrl);
    } catch {
      // ignore
    }
  }, [navigate]);

  // Quick Add Modal State
  const [quickAddModal, setQuickAddModal] = useState<{
    isOpen: boolean;
    type?: QuickAddType;
    defaultDate?: string;
  }>({
    isOpen: false,
    type: 'tarea',
    defaultDate: getTodayString(),
  });

  // Desktop Productivity States
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Global Desktop Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

      // Cmd+J or Ctrl+J -> Copiloto Gemini
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setShowGeminiChat(prev => !prev);
        return;
      }

      // If user is actively typing in an input, textarea, or select, do not trigger single-key shortcuts
      const target = e.target as HTMLElement | null;
      const isTyping = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      if (isTyping) return;

      // '?' -> Keyboard shortcuts modal
      if (e.key === '?') {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
        return;
      }

      // 'g' or 'G' -> Grafo de Conocimiento
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        navigate('/grafo');
        return;
      }

      // 'n' or 'N' -> Notas & Documentación
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/notas');
        return;
      }

      // 'c' or 'C' -> Calendario 360°
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        navigate('/calendario');
        return;
      }

      // Escape -> close modals
      if (e.key === 'Escape') {
        if (showGeminiChat) setShowGeminiChat(false);
        if (showCommandPalette) setShowCommandPalette(false);
        if (showKeyboardShortcuts) setShowKeyboardShortcuts(false);
        return;
      }

      // '1', '2', '3', '4', '5' -> Switch 5 main sections (Hoy, Clientes, Dinero, Cerebro, Ajustes)
      if (e.key === '1') {
        navigate('/hoy');
        return;
      }
      if (e.key === '2') {
        navigate('/clientes');
        return;
      }
      if (e.key === '3') {
        navigate('/dinero');
        return;
      }
      if (e.key === '4') {
        navigate('/cerebro');
        return;
      }
      if (e.key === '5') {
        navigate('/ajustes');
        return;
      }

      // 't' or 'T' -> Quick Add Task
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setQuickAddModal({
          isOpen: true,
          type: 'tarea',
          defaultDate: getTodayString(),
        });
        return;
      }

      // 'r' or 'R' -> Quick Add Meeting
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setQuickAddModal({
          isOpen: true,
          type: 'reunion',
          defaultDate: getTodayString(),
        });
        return;
      }

      // 'p' or 'P' -> Quick Add Project
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setQuickAddModal({
          isOpen: true,
          type: 'proyecto',
          defaultDate: getTodayString(),
        });
        return;
      }

      // 'f' or 'F' -> Modo Foco
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        navigate('/foco');
        return;
      }

      // 'h' or 'H' -> Horizonte (Largo Plazo & Capacidad)
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        navigate('/horizonte');
        return;
      }

      // 'm' or 'M' -> Toggle audio feedback
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleToggleSound();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, showKeyboardShortcuts]);

  // REAL-TIME FIRESTORE SUBSCRIPTIONS
  // Synchronizes changes across Phone and PC instantly via WebSockets without conflicts
  useEffect(() => {
    if (!authToken) return;

    setSyncStatus('syncing');

    // 1. Initial smart bidirectional sync: Upload any local un-synced items & seed
    syncLocalDataWithFirestore(
      getStoredTasks(),
      getStoredMeetings(),
      getStoredProjects(),
      getStoredIncomes(),
      getStoredExpenses(),
      getStoredWeeklyGoals()
    ).then(({ uploaded }) => {
      if (uploaded > 0) {
        console.log(`[Sync] Sincronizados ${uploaded} elementos locales con Firestore.`);
      }
    }).catch(err => {
      console.warn('[Sync Error]', err);
    });

    // 2. Real-time live listeners for all collections
    const unsubTasks = subscribeTasks(
      (items) => {
        setTasks(items);
        saveStoredTasks(items);
        setSyncStatus('synced');
      },
      () => setSyncStatus('offline')
    );

    const unsubMeetings = subscribeMeetings(
      (items) => {
        setMeetings(items);
        saveStoredMeetings(items);
        setSyncStatus('synced');
      },
      () => setSyncStatus('offline')
    );

    const unsubProjects = subscribeProjects(
      (items) => {
        setProjects(items);
        setCloudLoaded(prev => (prev.projects ? prev : { ...prev, projects: true }));
        saveStoredProjects(items);
        setSyncStatus('synced');
      },
      () => setSyncStatus('offline')
    );

    const unsubIncomes = subscribeIncomes(
      (items) => {
        setIncomes(items);
        saveStoredIncomes(items);
        setSyncStatus('synced');
      },
      () => setSyncStatus('offline')
    );

    const unsubExpenses = subscribeExpenses(
      (items) => {
        setExpenses(items);
        saveStoredExpenses(items);
        setSyncStatus('synced');
      },
      () => setSyncStatus('offline')
    );

    const unsubWeeklyGoals = subscribeWeeklyGoals(
      (items) => {
        const migrated = migrateGoalsToMissions(items);
        setWeeklyGoals(migrated);
        saveStoredWeeklyGoals(migrated);
        setSyncStatus('synced');
      },
      () => setSyncStatus('offline')
    );

    const unsubNotes = subscribeNotes(
      (items) => {
        setNotes(items);
        saveStoredNotes(items);
      },
      () => {}
    );

    const unsubPafPricing = subscribePafPricing((pricing) => {
      saveStoredPafPricingSettings(pricing);
    });

    // Personal Finance Subscriptions
    const unsubPersonalAccounts = subscribePersonalAccounts(
      (items) => {
        setPersonalAccounts(items);
        saveStoredPersonalAccounts(items);
      },
      () => {}
    );

    const unsubPersonalCategories = subscribePersonalCategories(
      (items) => {
        setPersonalCategories(items);
        saveStoredPersonalCategories(items);
      },
      () => {}
    );

    const unsubPersonalTransactions = subscribePersonalTransactions(
      (items) => {
        setPersonalTransactions(items);
        saveStoredPersonalTransactions(items);
      },
      () => {}
    );

    const unsubPersonalRecurrings = subscribePersonalRecurrings(
      (items) => {
        setPersonalRecurrings(items);
        saveStoredPersonalRecurrings(items);
      },
      () => {}
    );

    const unsubPersonalBudgets = subscribePersonalBudgets(
      (items) => {
        setPersonalBudgets(items);
        saveStoredPersonalBudgets(items);
      },
      () => {}
    );

    const unsubSavingsGoals = subscribePersonalSavingsGoals(
      (items) => {
        setSavingsGoals(items);
        saveStoredPersonalSavingsGoals(items);
      },
      () => {}
    );

    const unsubStudyItems = subscribePersonalStudyItems(
      (items) => {
        setStudyItems(items);
        saveStoredPersonalStudyItems(items);
      },
      () => {}
    );

    const unsubPersonalSettings = subscribePersonalFinanceSettings(
      (newSettings) => {
        setPersonalFinanceSettings(newSettings);
        saveStoredPersonalSettings(newSettings);
      },
      () => {}
    );

    const unsubMp = subscribeMpIncoming(items => setMpIncoming(items));

    const unsubClients = subscribeClients(items => {
      setClients(items);
      setCloudLoaded(prev => (prev.clients ? prev : { ...prev, clients: true }));
    });

    const unsubStudioFixed = subscribeStudioFixedExpenses(
      (items) => {
        setStudioFixedExpenses(items);
        saveStoredStudioFixedExpenses(items);
      },
      () => {}
    );

    seedPersonalFinanceDefaultsIfEmpty(personalAccounts, personalCategories).catch(err => {
      console.warn('Error seeding personal finance defaults:', err);
    });

    return () => {
      unsubTasks();
      unsubMeetings();
      unsubProjects();
      unsubIncomes();
      unsubExpenses();
      unsubWeeklyGoals();
      unsubNotes();
      unsubPafPricing();
      unsubPersonalAccounts();
      unsubPersonalCategories();
      unsubPersonalTransactions();
      unsubPersonalRecurrings();
      unsubPersonalBudgets();
      unsubSavingsGoals();
      unsubStudyItems();
      unsubPersonalSettings();
      unsubStudioFixed();
      unsubClients();
      unsubMp();
    };
  }, [authToken]);

  // Cotización del dólar: automática (blue/MEP/oficial) o manual, según Mis finanzas > Ajustes
  const usdRates = useUsdRates();
  const effectiveUsdRate = resolveUsdRate(
    personalFinanceSettings.usdRateSource,
    usdRates,
    personalFinanceSettings.usdExchangeRate
  );
  // Las vistas de finanzas leen settings.usdExchangeRate: se les pasa ya la cotización vigente
  const effectivePersonalSettings = { ...personalFinanceSettings, usdExchangeRate: effectiveUsdRate };

  // Vincular proyectos con su cliente (por nombre). Solo con datos de la nube, para no
  // crear clientes repetidos desde una copia local vieja. Es aditivo.
  const clientLinkInFlight = useRef(false);
  useEffect(() => {
    if (!authToken || !cloudLoaded.projects || !cloudLoaded.clients || clientLinkInFlight.current) return;
    const plan = planClientLinks(projects, clients, getTodayString());
    if (plan.projectLinks.length === 0) return;
    clientLinkInFlight.current = true;
    applyClientLinks(plan.newClients, plan.projectLinks)
      .catch(err => console.warn('Error vinculando clientes:', err))
      .finally(() => {
        clientLinkInFlight.current = false;
      });
  }, [authToken, cloudLoaded, projects, clients]);

  const handleUpdateClient = (client: Client) => {
    setClients(prev => prev.map(c => (c.id === client.id ? client : c)));
    saveClientToFirestore(client).catch(err => console.warn('Error guardando cliente:', err));
  };

  // El Copiloto y los widgets se descargan la primera vez que se abren
  const [copilotMounted, setCopilotMounted] = useState(false);
  const [iosWidgetsMounted, setIosWidgetsMounted] = useState(false);
  useEffect(() => {
    if (showGeminiChat) setCopilotMounted(true);
  }, [showGeminiChat]);
  useEffect(() => {
    if (showIosWidgetsModal) setIosWidgetsMounted(true);
  }, [showIosWidgetsModal]);

  // Con la app ya abierta y en reposo, se adelanta la descarga de las pantallas más usadas
  // para que al tocarlas abran al instante
  useEffect(() => {
    if (!authToken) return;
    const preload = () => {
      import('./views/ProjectsSimpleView');
      import('./views/DineroUnifiedView');
      import('./views/IncomeView');
      import('./views/SemanaView');
      import('./views/AjustesView');
    };
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(preload, { timeout: 4000 }) : setTimeout(preload, 2500);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id));
  }, [authToken]);

  // ---- Registrar pagos de Mercado Pago ----
  const pendingMp = mpIncoming.filter(p => !p.reconciled);

  const handleMpAsProjectPayment = (
    projectId: string,
    data: { amount: number; currency: 'ARS' | 'USD'; date: string; method: any; note?: string; destinationAccountId?: string; invoiced?: boolean },
    mpId: string
  ) => {
    const project = projects.find(p => p.id === projectId);
    handleSaveProjectPayment(
      projectId,
      {
        id: `pay_mp_${mpId}`,
        projectId,
        amount: data.amount,
        currency: data.currency,
        date: data.date,
        method: 'mercadopago',
        note: data.note,
        invoiced: data.invoiced,
        facturado: data.invoiced,
        createdAt: new Date().toISOString(),
      },
      { destinationAccountId: data.destinationAccountId }
    );
    markMpIncomingReconciled(mpId, { type: 'cliente', targetId: projectId, targetName: project?.clientName, reconciledAt: new Date().toISOString(), destinationAccountId: data.destinationAccountId }).catch(err => console.warn(err));
  };

  const handleMpAsStudioIncome = (
    data: { title: string; amount: number; currency: 'ARS' | 'USD'; date: string; category: any; notes?: string },
    mpId: string
  ) => {
    handleAddIncome({ title: data.title, amount: data.amount, currency: data.currency, date: data.date, month: data.date.slice(0, 7), status: 'cobrado', category: data.category, notes: data.notes, source: 'mercadopago' } as any);
    markMpIncomingReconciled(mpId, { type: 'estudio_libre', targetName: data.title, reconciledAt: new Date().toISOString() }).catch(err => console.warn(err));
  };

  const handleMpAsPersonal = (
    data: { accountId: string; amount: number; currency: 'ARS' | 'USD'; date: string; note: string; category?: string },
    mpId: string
  ) => {
    const incomeCategory = personalCategories.find(c => c.type === 'ingreso')?.id || 'cat_ing_cobros_cero';
    handleSavePersonalTransaction({ type: 'ingreso', amount: data.amount, currency: data.currency, date: data.date, accountId: data.accountId, categoryId: data.category || incomeCategory, note: data.note, status: 'confirmado' });
    markMpIncomingReconciled(mpId, { type: 'personal', targetId: data.accountId, reconciledAt: new Date().toISOString(), destinationAccountId: data.accountId }).catch(err => console.warn(err));
  };

  const handleMpDismiss = (mpId: string) => {
    markMpIncomingReconciled(mpId, { type: 'ignorado', reconciledAt: new Date().toISOString() }).catch(err => console.warn(err));
  };

  // Pagos que hiciste vos: se anotan como gasto (del estudio o personal) o se ignoran
  const handleMpSentAsExpense = (payment: MercadoPagoIncomingPayment, kind: 'estudio' | 'personal') => {
    const date = payment.dateApproved || payment.dateCreated || getTodayString();
    const title = payment.description || 'Pago con Mercado Pago';
    if (kind === 'estudio') {
      handleAddExpense({ title, category: 'Otros', month: date.slice(0, 7), date, amount: payment.amount, currency: payment.currency, status: 'pagado', notes: `Mercado Pago #${payment.mpPaymentId}` });
      markMpIncomingReconciled(payment.id, { type: 'gasto_estudio', targetName: title, reconciledAt: new Date().toISOString() }).catch(err => console.warn(err));
    } else {
      const account = personalAccounts.find(a => /mercado/i.test(a.name)) || personalAccounts[0];
      const category = personalCategories.find(c => c.type === 'gasto')?.id || '';
      handleSavePersonalTransaction({ type: 'gasto', amount: payment.amount, currency: payment.currency, date, accountId: account?.id || '', categoryId: category, note: title, status: 'confirmado' });
      markMpIncomingReconciled(payment.id, { type: 'gasto_personal', targetId: account?.id, reconciledAt: new Date().toISOString() }).catch(err => console.warn(err));
    }
  };

  // ---- Aviso en pantalla apenas entra un cobro ----
  // Se muestra una sola vez por pago (recordado en este dispositivo) y solo si es de las últimas 48 hs.
  const MP_SEEN_KEY = 'cero_mp_alert_seen';
  const [mpSeen, setMpSeen] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(MP_SEEN_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });
  const markMpSeen = useCallback((id: string) => {
    setMpSeen(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(MP_SEEN_KEY, JSON.stringify([...next].slice(-300)));
      } catch {}
      return next;
    });
  }, []);
  const mpAlertQueue = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return mpIncoming.filter(p => {
      if (p.reconciled || p.direction === 'enviado' || p.status !== 'approved' || mpSeen.has(p.id)) return false;
      const when = Date.parse(p.receivedAt || p.dateApproved || p.dateCreated || '');
      return Number.isFinite(when) && when >= cutoff;
    });
  }, [mpIncoming, mpSeen]);
  const mpAlert = mpAlertQueue[0] || null;
  const lastAlertedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mpAlert || lastAlertedRef.current === mpAlert.id) return;
    lastAlertedRef.current = mpAlert.id;
    playPaymentReceived();
    hapticFeedback.success();
  }, [mpAlert]);

  // Portal del alumno: mantiene publicada la "foto" de cada alumno PAF con link activo
  const publishedPortalKeysRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!authToken) return;
    projects.forEach(project => {
      const token = project.studentPortalToken;
      if (!token) return;
      const snapshot = buildStudentPortalSnapshot(project, token, meetings);
      const key = portalSnapshotKey(snapshot);
      if (publishedPortalKeysRef.current.get(token) === key) return;
      publishedPortalKeysRef.current.set(token, key);
      publishStudentPortal(snapshot).catch(err => {
        publishedPortalKeysRef.current.delete(token);
        console.warn('Error publicando portal del alumno:', err);
      });
    });
  }, [authToken, projects, meetings]);

  const handleForceSync = async () => {
    setSyncStatus('syncing');
    try {
      const res = await syncLocalDataWithFirestore(
        tasks,
        meetings,
        projects,
        incomes,
        expenses,
        weeklyGoals
      );
      setSyncStatus('synced');
      showToast(res.uploaded > 0 ? `Sincronizados ${res.uploaded} datos con la nube` : 'Firebase sincronizado al 100%');
    } catch (err) {
      console.error('Manual sync error:', err);
      setSyncStatus('offline');
      showToast('Error al conectar con Firebase');
    }
  };

  // Periodic Reminder Checker
  // Checks active tasks and meetings with scheduled reminders and triggers system notifications
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const currentTasks = tasksRef.current;
      const currentMeetings = meetingsRef.current;

      // Check Tasks
      if (currentTasks && currentTasks.length > 0) {
        currentTasks.forEach(task => {
          if (task.completed || task.reminderNotified) return;
          if (!task.date || task.date !== todayStr) return;
          if (!task.time || !task.time.includes(':')) return;
          if (task.reminderMinutesBefore === undefined) return;

          const [tH, tM] = task.time.split(':').map(Number);
          const taskMinutes = tH * 60 + tM;
          const targetAlertMinutes = taskMinutes - task.reminderMinutesBefore;

          // If current time is at or past target alert time (within a 15 min window)
          if (nowMinutes >= targetAlertMinutes && nowMinutes <= targetAlertMinutes + 15) {
            const title = `Recordatorio: ${task.title}`;
            const body = task.projectName
              ? `Proyecto: ${task.projectName} · ${task.time} hs`
              : `Hora fijada: ${task.time} hs`;

            showSystemNotification(title, {
              body,
              tag: `reminder-task-${task.id}`,
            });

            // Mark as notified so it doesn't repeat
            setTasks(prev => {
              const updated = prev.map(t => (t.id === task.id ? { ...t, reminderNotified: true } : t));
              saveStoredTasks(updated);
              return updated;
            });

            updateTaskInFirestore(task.id, { reminderNotified: true }).catch(err =>
              console.error('Error updating reminderNotified for task:', err)
            );
          }
        });
      }

      // Check Meetings
      if (currentMeetings && currentMeetings.length > 0) {
        currentMeetings.forEach(meet => {
          if (meet.completed || meet.reminderNotified) return;
          if (!meet.date || meet.date !== todayStr) return;
          if (!meet.time || !meet.time.includes(':')) return;
          if (meet.reminderMinutesBefore === undefined) return;

          const [mH, mM] = meet.time.split(':').map(Number);
          const meetMinutes = mH * 60 + mM;
          const targetAlertMinutes = meetMinutes - meet.reminderMinutesBefore;

          if (nowMinutes >= targetAlertMinutes && nowMinutes <= targetAlertMinutes + 15) {
            const title = `Reunión: ${meet.title}`;
            const body = [
              meet.time ? `A las ${meet.time} hs` : '',
              meet.projectName ? `Proyecto: ${meet.projectName}` : '',
              meet.clientPhone ? `Tel: ${meet.clientPhone}` : '',
            ].filter(Boolean).join(' · ');

            showSystemNotification(title, {
              body,
              tag: `reminder-meeting-${meet.id}`,
            });

            // Mark as notified so it doesn't repeat
            setMeetings(prev => {
              const updated = prev.map(m => (m.id === meet.id ? { ...m, reminderNotified: true } : m));
              saveStoredMeetings(updated);
              return updated;
            });

            updateMeetingInFirestore(meet.id, { reminderNotified: true }).catch(err =>
              console.error('Error updating reminderNotified for meeting:', err)
            );
          }
        });
      }
    };

    // Run check immediately and every 30 seconds
    checkReminders();
    const intervalId = setInterval(checkReminders, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Cerrar sesión (Google)
  const handleLockSession = () => {
    signOutUser().catch(err => console.warn('Error al cerrar sesión:', err));
  };

  // Explicit Reset Database to 0 in Cloud
  const handleResetDatabase = () => {
    if (!authToken) return;
    setShowResetConfirmModal(true);
  };

  const handleConfirmResetDatabase = async () => {
    setShowResetConfirmModal(false);
    if (!authToken) return;

    setSyncStatus('syncing');
    try {
      await resetAllFirestoreData();
      clearAllLocalData();
      setTasks([]);
      setMeetings([]);
      setProjects([]);
      setIncomes([]);
      setExpenses([]);
      setWeeklyGoals([]);
      setTimeLogs([]);
      setNotes([]);
      setStudioFixedExpenses([]);
      setPersonalTransactions([]);
      setPersonalRecurrings([]);
      setPersonalBudgets([]);
      setSavingsGoals([]);
      setStudyItems([]);
      setSyncStatus('synced');
      showToast('Base de datos en la nube limpia y en 0');
    } catch (err) {
      console.error('Error resetting database:', err);
      showToast('Error al reiniciar base de datos');
      setSyncStatus('error');
    }
  };

  // --- Agenda Task Handlers ---
  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.completed;
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, completed: nextCompleted } : t);
      saveStoredTasks(updated);
      return updated;
    });

    if (nextCompleted) {
      playTaskDone();
    } else {
      playSubtaskToggle();
    }

    try {
      await updateTaskInFirestore(taskId, { completed: nextCompleted });
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleMoveTaskDate = async (taskId: string, targetDate: string) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, date: targetDate } : t);
      saveStoredTasks(updated);
      return updated;
    });
    playPostpone();
    try {
      await updateTaskInFirestore(taskId, { date: targetDate });
      const todayStr = getTodayString();
      if (targetDate === todayStr) {
        showToast('Tarea movida a hoy');
      } else {
        showToast('Tarea postergada a mañana');
      }
    } catch (err) {
      console.error('Error moving task date:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (taskToDelete) {
      addTrashRecord({
        id: taskToDelete.id,
        itemType: 'tarea',
        title: taskToDelete.title,
        subtitle: taskToDelete.projectName || taskToDelete.date,
        data: taskToDelete,
      });
    }
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== taskId);
      saveStoredTasks(updated);
      return updated;
    });
    playItemDeleted();
    try {
      await deleteTaskFromFirestore(taskId);
      showToast('Tarea enviada a la papelera', () => {
        if (taskToDelete) {
          handleAddTask(taskToDelete);
          purgeTrashRecord(taskToDelete.id);
        }
      });
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<AgendaTask>) => {
    let cleanUpdates = { ...updates };
    // Synchronize or unbind project fields
    if ('projectId' in updates) {
      if (updates.projectId) {
        const match = projects.find(p => p.id === updates.projectId);
        if (match && !updates.projectName) {
          cleanUpdates.projectName = match.clientName;
        }
      } else {
        // "Sin proyecto" -> clear both fields
        cleanUpdates.projectId = undefined;
        cleanUpdates.projectName = undefined;
      }
    }

    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== taskId) return t;
        const merged = { ...t, ...cleanUpdates };
        if (cleanUpdates.projectId === undefined && 'projectId' in cleanUpdates) {
          delete merged.projectId;
        }
        if (cleanUpdates.projectName === undefined && 'projectName' in cleanUpdates) {
          delete merged.projectName;
        }
        return merged;
      });
      saveStoredTasks(updated);
      return updated;
    });
    try {
      await updateTaskInFirestore(taskId, cleanUpdates);
      showToast('Tarea actualizada');
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleReorderTasks = async (
    dateOrTaskIds: string | string[],
    reorderedTasks?: AgendaTask[]
  ) => {
    let orderedTaskIds: string[] = [];
    if (Array.isArray(dateOrTaskIds)) {
      orderedTaskIds = dateOrTaskIds;
    } else if (reorderedTasks) {
      orderedTaskIds = reorderedTasks.map(t => t.id);
    } else {
      return;
    }

    setTasks(prev => {
      const orderMap = new Map<string, number>();
      orderedTaskIds.forEach((id, idx) => orderMap.set(id, idx));
      const updated = prev.map(t => {
        if (orderMap.has(t.id)) {
          return { ...t, orderIndex: orderMap.get(t.id) };
        }
        return t;
      });
      saveStoredTasks(updated);
      return updated;
    });

    // Persist order updates to Firestore for each changed task
    try {
      await Promise.all(
        orderedTaskIds.map((id, index) =>
          updateTaskInFirestore(id, { orderIndex: index })
        )
      );
    } catch (err) {
      console.error('Error updating task order in Firestore:', err);
    }
  };

  const handleAddTask = async (newTaskData: Omit<AgendaTask, 'id' | 'createdAt'>) => {
    let pId = newTaskData.projectId;
    let pName = newTaskData.projectName;
    if (pId && !pName) {
      const match = projects.find(p => p.id === pId);
      if (match) pName = match.clientName;
    } else if (!pId && pName) {
      const match = resolveTaskProject({ ...newTaskData, id: '', createdAt: '', completed: false } as AgendaTask, projects);
      if (match) {
        pId = match.id;
        pName = match.clientName;
      }
    }

    const newTask: AgendaTask = {
      ...newTaskData,
      projectId: pId,
      projectName: pName,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: getTodayString(),
    };
    setTasks(prev => {
      const updated = [newTask, ...prev];
      saveStoredTasks(updated);
      return updated;
    });
    playItemCreated();
    try {
      await saveTaskToFirestore(newTask);
      showToast('Tarea agregada');
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  // --- Subtask Handlers ---
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    let playDoneSound = false;
    let playAllCompletedSound = false;
    let nextSubtasksToSave: SubTask[] = [];

    setTasks(prev => {
      const updated = prev.map(task => {
        if (task.id !== taskId) return task;

        const currentSubtasks = task.subtasks || [];
        const nextSubtasks = currentSubtasks.map(sub => {
          if (sub.id !== subtaskId) return sub;
          const nextDone = !sub.completed;
          if (nextDone) playDoneSound = true;
          return { ...sub, completed: nextDone };
        });

        // Check if all subtasks are now completed
        const allCompleted = nextSubtasks.length > 0 && nextSubtasks.every(s => s.completed);
        if (allCompleted && playDoneSound) {
          playAllCompletedSound = true;
        }

        nextSubtasksToSave = nextSubtasks;
        const mappedSubtareas: SubtareaFoco[] = nextSubtasks.map(s => ({
          id: s.id,
          titulo: s.title,
          hecha: s.completed,
        }));
        return { ...task, subtasks: nextSubtasks, subtareas: mappedSubtareas };
      });

      saveStoredTasks(updated);
      return updated;
    });

    if (playAllCompletedSound) {
      playAllDone();
    } else if (playDoneSound) {
      playSubtaskDone();
    } else {
      playSubtaskToggle();
    }

    try {
      await updateTaskInFirestore(taskId, { 
        subtasks: nextSubtasksToSave,
        subtareas: nextSubtasksToSave.map(s => ({ id: s.id, titulo: s.title, hecha: s.completed }))
      });
    } catch (err) {
      console.error('Error updating subtask in Firestore:', err);
    }
  };

  const handleAddSubtask = async (taskId: string, title: string) => {
    const newSub: SubTask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      completed: false,
      createdAt: getTodayString(),
    };

    let updatedTaskSubtasks: SubTask[] = [];

    setTasks(prev => {
      const updated = prev.map(task => {
        if (task.id !== taskId) return task;
        const currentSubtasks = task.subtasks || [];
        updatedTaskSubtasks = [...currentSubtasks, newSub];
        const mappedSubtareas: SubtareaFoco[] = updatedTaskSubtasks.map(s => ({
          id: s.id,
          titulo: s.title,
          hecha: s.completed,
        }));
        return { ...task, subtasks: updatedTaskSubtasks, subtareas: mappedSubtareas };
      });
      saveStoredTasks(updated);
      return updated;
    });

    playItemCreated();
    showToast('Subtarea agregada');

    try {
      await updateTaskInFirestore(taskId, { 
        subtasks: updatedTaskSubtasks,
        subtareas: updatedTaskSubtasks.map(s => ({ id: s.id, titulo: s.title, hecha: s.completed }))
      });
    } catch (err) {
      console.error('Error adding subtask in Firestore:', err);
    }
  };

  const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
    let updatedTaskSubtasks: SubTask[] = [];

    setTasks(prev => {
      const updated = prev.map(task => {
        if (task.id !== taskId) return task;
        const currentSubtasks = task.subtasks || [];
        updatedTaskSubtasks = currentSubtasks.filter(s => s.id !== subtaskId);
        const mappedSubtareas: SubtareaFoco[] = updatedTaskSubtasks.map(s => ({
          id: s.id,
          titulo: s.title,
          hecha: s.completed,
        }));
        return { ...task, subtasks: updatedTaskSubtasks, subtareas: mappedSubtareas };
      });
      saveStoredTasks(updated);
      return updated;
    });

    playItemDeleted();

    try {
      await updateTaskInFirestore(taskId, { 
        subtasks: updatedTaskSubtasks,
        subtareas: updatedTaskSubtasks.map(s => ({ id: s.id, titulo: s.title, hecha: s.completed }))
      });
    } catch (err) {
      console.error('Error deleting subtask in Firestore:', err);
    }
  };

  // --- Agenda Meeting Handlers ---
  const handleToggleMeeting = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const nextCompleted = !meeting.completed;
    setMeetings(prev => {
      const updated = prev.map(m => m.id === meetingId ? { ...m, completed: nextCompleted } : m);
      saveStoredMeetings(updated);
      return updated;
    });

    if (nextCompleted) {
      playTaskDone();
    } else {
      playSubtaskToggle();
    }

    try {
      await updateMeetingInFirestore(meetingId, { completed: nextCompleted });
    } catch (err) {
      console.error('Error toggling meeting:', err);
    }

    // Bidirectional sync: If meeting is linked to a PAF Client Architect, auto-increment/decrement consulting hours
    if (meeting.projectId) {
      const sessionHours = meeting.durationHours ?? 1;
      let impactedProject: Project | null = null;
      let newHoursDone = 0;

      setProjects(prevProjects => {
        const targetProj = prevProjects.find(p => p.id === meeting.projectId);
        if (!targetProj || !(targetProj.projectType === 'paf_pro' || targetProj.projectType === 'paf_base' || targetProj.pafConsultingHoursTotal || targetProj.pafStage)) {
          return prevProjects;
        }

        const currentDone = targetProj.pafConsultingHoursDone ?? 0;
        newHoursDone = nextCompleted
          ? Math.min((targetProj.pafConsultingHoursTotal ?? 26), Math.max(0, currentDone + sessionHours))
          : Math.max(0, currentDone - sessionHours);

        impactedProject = targetProj;
        const updated = prevProjects.map(p =>
          p.id === targetProj.id ? { ...p, pafConsultingHoursDone: newHoursDone, updatedAt: getTodayString() } : p
        );
        saveStoredProjects(updated);
        return updated;
      });

      if (impactedProject) {
        const proj = impactedProject as Project;
        updateProjectInFirestore(proj.id, { pafConsultingHoursDone: newHoursDone, updatedAt: getTodayString() }).catch(err =>
          console.error('Error updating PAF project hours:', err)
        );
        showToast(
          nextCompleted
            ? `Sesión registrada: +${sessionHours}h en ${proj.clientName} (${newHoursDone}/${proj.pafConsultingHoursTotal ?? 26}hs)`
            : `Sesión desmarcada: -${sessionHours}h en ${proj.clientName} (${newHoursDone}/${proj.pafConsultingHoursTotal ?? 26}hs)`
        );
      }
    }
  };

  const handleMoveMeetingDate = async (meetingId: string, targetDate: string) => {
    setMeetings(prev => {
      const updated = prev.map(m => m.id === meetingId ? { ...m, date: targetDate } : m);
      saveStoredMeetings(updated);
      return updated;
    });
    playPostpone();
    try {
      await updateMeetingInFirestore(meetingId, { date: targetDate });
      showToast('Reunión postergada a mañana');
    } catch (err) {
      console.error('Error moving meeting:', err);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const meetingToDelete = meetings.find(m => m.id === meetingId);
    if (meetingToDelete) {
      addTrashRecord({
        id: meetingToDelete.id,
        itemType: 'reunion',
        title: meetingToDelete.title,
        subtitle: `${meetingToDelete.date} ${meetingToDelete.time || ''}`,
        data: meetingToDelete,
      });
    }
    setMeetings(prev => {
      const updated = prev.filter(m => m.id !== meetingId);
      saveStoredMeetings(updated);
      return updated;
    });
    playItemDeleted();
    try {
      await deleteMeetingFromFirestore(meetingId);
      showToast('Reunión enviada a la papelera', () => {
        if (meetingToDelete) {
          handleAddMeeting(meetingToDelete);
          purgeTrashRecord(meetingToDelete.id);
        }
      });
    } catch (err) {
      console.error('Error deleting meeting:', err);
    }
  };

  const handleUpdateMeeting = async (meetingId: string, updates: Partial<AgendaMeeting>) => {
    setMeetings(prev => {
      const updated = prev.map(m => m.id === meetingId ? { ...m, ...updates } : m);
      saveStoredMeetings(updated);
      return updated;
    });
    try {
      await updateMeetingInFirestore(meetingId, updates);
      showToast('Reunión actualizada');
    } catch (err) {
      console.error('Error updating meeting:', err);
    }
  };

  const handleAddMeeting = async (newMeetingData: Omit<AgendaMeeting, 'id' | 'createdAt'>) => {
    const newMeeting: AgendaMeeting = {
      ...newMeetingData,
      id: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: getTodayString(),
    };
    setMeetings(prev => {
      const updated = [newMeeting, ...prev];
      saveStoredMeetings(updated);
      return updated;
    });
    playItemCreated();
    try {
      await saveMeetingToFirestore(newMeeting);
      showToast('Reunión agendada');
    } catch (err) {
      console.error('Error adding meeting:', err);
    }
  };

  // --- Projects Handlers ---
  const handleAddProject = async (newProjectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = getTodayString();
    const newProject: Project = {
      ...newProjectData,
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setProjects(prev => {
      const updated = [newProject, ...prev];
      saveStoredProjects(updated);
      return updated;
    });
    playItemCreated();
    try {
      await saveProjectToFirestore(newProject);
      showToast('Proyecto registrado');
    } catch (err) {
      console.error('Error adding project:', err);
    }
    return newProject.id;
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
    const fullUpdates = { ...updates, updatedAt: getTodayString() };
    setProjects(prev => {
      const updated = prev.map(p =>
        p.id === id ? { ...p, ...fullUpdates } : p
      );
      saveStoredProjects(updated);
      return updated;
    });
    try {
      await updateProjectInFirestore(id, fullUpdates);
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const projectToDelete = projects.find(p => p.id === id);
    if (projectToDelete?.studentPortalToken) {
      // Si se borra el cliente, su link deja de funcionar
      publishedPortalKeysRef.current.delete(projectToDelete.studentPortalToken);
      unpublishStudentPortal(projectToDelete.studentPortalToken).catch(err => console.warn(err));
    }
    if (projectToDelete) {
      addTrashRecord({
        id: projectToDelete.id,
        itemType: 'cliente',
        title: projectToDelete.clientName,
        subtitle: projectToDelete.status,
        amount: projectToDelete.estimatedPrice,
        currency: projectToDelete.estimatedCurrency,
        data: projectToDelete,
      });
    }
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveStoredProjects(updated);
      return updated;
    });
    playItemDeleted();
    try {
      await deleteProjectFromFirestore(id);
      showToast('Cliente enviado a la papelera', () => {
        if (projectToDelete) {
          handleAddProject(projectToDelete);
          purgeTrashRecord(projectToDelete.id);
        }
      });
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleToggleArchiveProject = async (id: string) => {
    const p = projects.find(item => item.id === id);
    if (!p) return;
    const nextArchived = !p.archived;
    const fullUpdates = { archived: nextArchived, updatedAt: getTodayString() };
    setProjects(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, ...fullUpdates } : item
      );
      saveStoredProjects(updated);
      return updated;
    });
    try {
      await updateProjectInFirestore(id, fullUpdates);
      showToast(nextArchived ? 'Proyecto archivado' : 'Proyecto desarchivado');
    } catch (err) {
      console.error('Error toggling archive project:', err);
    }
  };

  // --- Real Project Payments Handlers ---
  const handleSaveProjectPayment = async (
    projectId: string,
    payment: Payment,
    options?: {
      destinationAccountId?: string;
      followUpCommitment?: { amount: number; dueDate: string; title?: string };
    }
  ) => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;

    const existingPayments = targetProject.payments || [];
    const isEditing = existingPayments.some(p => p.id === payment.id);

    // 1. IncomeRecord Synchronization (Automatic 1:1 sync, no double load)
    const incomeId = payment.incomeRecordId || `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const destAccountId = options?.destinationAccountId ?? payment.destinationAccountId;
    let personalTxId = payment.personalTransactionId;

    // 2. Personal Finance Account Credit (if destination account selected)
    if (destAccountId && destAccountId !== 'none') {
      if (!personalTxId) {
        personalTxId = `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      }
      const txData: PersonalTransaction = {
        id: personalTxId,
        type: 'ingreso',
        amount: payment.amount,
        currency: payment.currency,
        date: payment.date,
        accountId: destAccountId,
        categoryId: 'cat_cobro_cliente',
        note: `Cobro cliente: ${targetProject.clientName}${payment.note ? ` (${payment.note})` : ''}`,
        status: 'confirmado',
        projectId: targetProject.id,
        createdAt: new Date().toISOString(),
      };

      setPersonalTransactions(prev => {
        const filtered = prev.filter(t => t.id !== personalTxId);
        const updated = [txData, ...filtered];
        saveStoredPersonalTransactions(updated);
        return updated;
      });
      savePersonalTransactionToFirestore(txData).catch(err => console.warn(err));
    } else if (personalTxId) {
      // Al editar y quitar la cuenta destino, el movimiento viejo no debe seguir sumando en Mis Finanzas
      handleDeletePersonalTransaction(personalTxId);
      personalTxId = undefined;
    }

    const paymentWithMeta: Payment = {
      ...payment,
      incomeRecordId: incomeId,
      destinationAccountId: destAccountId && destAccountId !== 'none' ? destAccountId : undefined,
      personalTransactionId: personalTxId,
    };

    const nextPayments = isEditing
      ? existingPayments.map(p => p.id === payment.id ? paymentWithMeta : p)
      : [paymentWithMeta, ...existingPayments];

    // Follow-up commitment if partial
    let nextCommitments = targetProject.paymentCommitments || [];
    if (options?.followUpCommitment && options.followUpCommitment.amount > 0) {
      nextCommitments = [
        ...nextCommitments,
        {
          id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: options.followUpCommitment.title || 'Saldo pendiente',
          amount: options.followUpCommitment.amount,
          dueDate: options.followUpCommitment.dueDate,
          currency: payment.currency,
          status: 'pendiente',
          projectId: targetProject.id,
          clientName: targetProject.clientName,
        }
      ];
    }

    // Update project state & storage & firestore
    const projectUpdates: Partial<Project> = {
      payments: nextPayments,
      paymentCommitments: nextCommitments.length > 0 ? nextCommitments : undefined,
      updatedAt: getTodayString(),
    };
    handleUpdateProject(projectId, projectUpdates);

    // Upsert IncomeRecord
    const existingIncome = incomes.find(i => i.id === incomeId);
    const incomeData: IncomeRecord = {
      id: incomeId,
      title: payment.note ? `${payment.note} (${targetProject.clientName})` : `Pago de ${targetProject.clientName}`,
      concept: payment.note || `Cobro ${targetProject.clientName}`,
      amount: payment.amount,
      currency: payment.currency,
      date: payment.date,
      month: payment.date.slice(0, 7),
      status: 'cobrado',
      projectId: targetProject.id,
      projectName: targetProject.clientName,
      source: 'proyecto',
      facturado: payment.facturado,
      paymentId: payment.id,
      createdAt: existingIncome?.createdAt || getTodayString(),
    };

    if (existingIncome) {
      handleUpdateIncome(incomeId, incomeData);
    } else {
      setIncomes(prev => {
        const updated = [incomeData, ...prev];
        saveStoredIncomes(updated);
        return updated;
      });
      saveIncomeToFirestore(incomeData).catch(err => console.error(err));
    }

    hapticFeedback.success();
    playItemCreated();
    showToast(isEditing ? 'Pago actualizado' : 'Pago registrado exitosamente');
  };

  const handleDeleteProjectPayment = async (projectId: string, paymentId: string) => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;

    // Get current real payments (either stored in payments array or extracted from legacy)
    const currentPayments = Array.isArray(targetProject.payments)
      ? targetProject.payments
      : getProjectPayments(targetProject, incomes);

    const paymentToDelete = currentPayments.find(p => p.id === paymentId) 
      || (targetProject.payments || []).find(p => p.id === paymentId);

    const nextPayments = currentPayments.filter(p => p.id !== paymentId);

    // If it was linked to an installment, unmark the installment as paid so legacy doesn't resurface
    let nextInstallments = targetProject.installments;
    if (nextInstallments && nextInstallments.length > 0) {
      nextInstallments = nextInstallments.map((inst, idx) => {
        const migInstId = `mig_inst_${targetProject.id}_${idx + 1}`;
        if (inst.id === paymentId || migInstId === paymentId || (paymentToDelete?.incomeRecordId && inst.incomeRecordId === paymentToDelete.incomeRecordId)) {
          return { ...inst, paid: false, status: 'pendiente' as const, paidAt: undefined };
        }
        return inst;
      });
    }

    // Always persist explicit payments array (even if empty []) so fallback doesn't revive deleted payments
    handleUpdateProject(projectId, {
      payments: nextPayments,
      installments: nextInstallments,
      updatedAt: getTodayString(),
    });

    // Delete corresponding IncomeRecord if it exists
    let incomeIdToDelete = paymentToDelete?.incomeRecordId;
    if (!incomeIdToDelete && paymentId.startsWith('mig_inc_')) {
      incomeIdToDelete = paymentId.replace('mig_inc_', '');
    }
    if (!incomeIdToDelete) {
      const directIncome = incomes.find(i => i.id === paymentId);
      if (directIncome) incomeIdToDelete = directIncome.id;
    }

    if (incomeIdToDelete) {
      handleDeleteIncome(incomeIdToDelete);
    }

    if (paymentToDelete?.personalTransactionId) {
      handleDeletePersonalTransaction(paymentToDelete.personalTransactionId);
    }

    hapticFeedback.medium();
    showToast('Pago eliminado');
  };

  // --- Income Handlers ---
  const handleAddIncome = async (newIncomeData: Omit<IncomeRecord, 'id' | 'createdAt'>) => {
    const newIncome: IncomeRecord = {
      ...newIncomeData,
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: getTodayString(),
    };
    setIncomes(prev => {
      const updated = [newIncome, ...prev];
      saveStoredIncomes(updated);
      return updated;
    });
    playItemCreated();
    try {
      await saveIncomeToFirestore(newIncome);
      showToast('Ingreso registrado');
    } catch (err) {
      console.error('Error adding income:', err);
    }
  };

  const handleUpdateIncome = async (id: string, updates: Partial<IncomeRecord>) => {
    setIncomes(prev => {
      const updated = prev.map(i => (i.id === id ? { ...i, ...updates } : i));
      saveStoredIncomes(updated);
      return updated;
    });
    try {
      await updateIncomeInFirestore(id, updates);
    } catch (err) {
      console.error('Error updating income:', err);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    const incomeToDelete = incomes.find(i => i.id === id);
    if (incomeToDelete) {
      addTrashRecord({
        id: incomeToDelete.id,
        itemType: 'ingreso',
        title: incomeToDelete.title || 'Ingreso',
        subtitle: incomeToDelete.concept || incomeToDelete.category || incomeToDelete.month,
        amount: incomeToDelete.amount,
        currency: incomeToDelete.currency,
        data: incomeToDelete,
      });
    }
    setIncomes(prev => {
      const updated = prev.filter(i => i.id !== id);
      saveStoredIncomes(updated);
      return updated;
    });
    playItemDeleted();
    try {
      await deleteIncomeFromFirestore(id);
      showToast('Ingreso enviado a la papelera', () => {
        if (incomeToDelete) {
          handleAddIncome(incomeToDelete);
          purgeTrashRecord(incomeToDelete.id);
        }
      });
    } catch (err) {
      console.error('Error deleting income:', err);
    }
  };

  // --- Expense Handlers ---
  const handleAddExpense = async (newExpenseData: Omit<ExpenseRecord, 'id' | 'createdAt'>) => {
    const newExpense: ExpenseRecord = {
      ...newExpenseData,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: getTodayString(),
    };
    setExpenses(prev => {
      const updated = [newExpense, ...prev];
      saveStoredExpenses(updated);
      return updated;
    });
    playItemCreated();
    try {
      await saveExpenseToFirestore(newExpense);
      showToast('Gasto registrado');
    } catch (err) {
      console.error('Error adding expense:', err);
    }
  };

  const handleUpdateExpense = async (id: string, updates: Partial<ExpenseRecord>) => {
    setExpenses(prev => {
      const updated = prev.map(e => (e.id === id ? { ...e, ...updates } : e));
      saveStoredExpenses(updated);
      return updated;
    });
    try {
      await updateExpenseInFirestore(id, updates);
    } catch (err) {
      console.error('Error updating expense:', err);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const expenseToDelete = expenses.find(e => e.id === id);
    if (expenseToDelete) {
      addTrashRecord({
        id: expenseToDelete.id,
        itemType: 'gasto',
        title: expenseToDelete.title || 'Gasto',
        subtitle: expenseToDelete.category,
        amount: expenseToDelete.amount,
        currency: expenseToDelete.currency,
        data: expenseToDelete,
      });
    }
    setExpenses(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveStoredExpenses(updated);
      return updated;
    });
    playItemDeleted();
    try {
      await deleteExpenseFromFirestore(id);
      showToast('Gasto enviado a la papelera', () => {
        if (expenseToDelete) {
          handleAddExpense(expenseToDelete);
          purgeTrashRecord(expenseToDelete.id);
        }
      });
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  // --- Weekly Goals Handlers ---
  const handleAddWeeklyGoal = async (
    title: string,
    category: 'ventas' | 'produccion' | 'organizacion' | 'general' = 'general',
    weekStart?: string
  ) => {
    const monday = weekStart || getWeekMonday(getTodayString());
    let inferredFrente: any = 'Otros';
    if (category === 'produccion') inferredFrente = 'PAF';
    else if (category === 'ventas') inferredFrente = 'Comercial';
    else if (title.toLowerCase().includes('web')) inferredFrente = 'Webs';
    else if (title.toLowerCase().includes('contenido')) inferredFrente = 'Contenido';

    const newGoal: WeeklyMission = {
      id: `mision-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      category,
      completed: false,
      weekStart: monday,
      createdAt: getTodayString(),
      resultadoEsperado: `Completar: ${title.trim()}`,
      frente: inferredFrente,
      tipo: 'mision',
      presupuestoHoras: 4,
      pasos: [
        { id: `p-${Date.now()}-1`, titulo: 'Fase inicial y alcance', hecho: false },
        { id: `p-${Date.now()}-2`, titulo: 'Ejecución clave', hecho: false },
        { id: `p-${Date.now()}-3`, titulo: 'Validación y cierre', hecho: false },
      ],
      diasPlanificados: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      estado: 'activa',
      orden: 0,
    };

    setWeeklyGoals(prev => {
      const updated = [newGoal, ...prev];
      saveStoredWeeklyGoals(updated);
      return updated;
    });

    playItemCreated();
    showToast('Misión semanal agregada');

    try {
      await saveWeeklyGoalToFirestore(newGoal);
    } catch (err) {
      console.error('Error saving weekly goal:', err);
    }
  };

  const handleSaveWeeklyMission = async (mission: WeeklyMission) => {
    setWeeklyGoals(prev => {
      const exists = prev.some(m => m.id === mission.id);
      const updated = exists
        ? prev.map(m => m.id === mission.id ? mission : m)
        : [mission, ...prev];
      saveStoredWeeklyGoals(updated);
      return updated;
    });

    try {
      await saveWeeklyGoalToFirestore(mission);
    } catch (err) {
      console.error('Error saving weekly mission:', err);
    }
  };

  const handleDeleteWeeklyMission = async (missionId: string) => {
    await handleDeleteWeeklyGoal(missionId);
  };

  const handleToggleWeeklyGoal = async (id: string) => {
    const goal = weeklyGoals.find(g => g.id === id);
    if (!goal) return;

    const nextCompleted = !goal.completed;
    setWeeklyGoals(prev => {
      const updated = prev.map(g => (g.id === id ? { ...g, completed: nextCompleted } : g));
      saveStoredWeeklyGoals(updated);
      return updated;
    });

    if (nextCompleted) {
      playTaskDone();
      showToast('¡Objetivo cumplido! 🎯');
    } else {
      playSubtaskToggle();
    }

    try {
      await updateWeeklyGoalInFirestore(id, { completed: nextCompleted });
    } catch (err) {
      console.error('Error toggling weekly goal:', err);
    }
  };

  const handleUpdateWeeklyGoal = async (id: string, updates: Partial<WeeklyGoal>) => {
    setWeeklyGoals(prev => {
      const updated = prev.map(g => (g.id === id ? { ...g, ...updates } : g));
      saveStoredWeeklyGoals(updated);
      return updated;
    });

    try {
      await updateWeeklyGoalInFirestore(id, updates);
    } catch (err) {
      console.error('Error updating weekly goal:', err);
    }
  };

  const handleDeleteWeeklyGoal = async (id: string) => {
    setWeeklyGoals(prev => {
      const updated = prev.filter(g => g.id !== id);
      saveStoredWeeklyGoals(updated);
      return updated;
    });

    playItemDeleted();
    showToast('Objetivo eliminado');

    try {
      await deleteWeeklyGoalFromFirestore(id);
    } catch (err) {
      console.error('Error deleting weekly goal:', err);
    }
  };

  // --- Backup & Data Management ---
  // Backup completo desde Firestore (todas las colecciones, incluidas notas y finanzas personales)
  const handleExportJSON = async () => {
    try {
      showToast('Generando copia de seguridad…');
      const backup = await exportCompleteCrmBackup();
      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cero-crm-backup-${getTodayString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Copia JSON descargada');
    } catch (err) {
      console.error('Error exporting JSON:', err);
      showToast('No se pudo generar la copia (¿sin conexión?)');
    }
  };

  const handleExportCSV = () => {
    try {
      const csvStr = exportAllDataCSV();
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cero-crm-datos-${getTodayString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Planilla CSV descargada');
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        // Los listeners de Firestore actualizan el estado al terminar la escritura
        const { imported } = await importCompleteCrmBackup(parsed);
        showToast(`Copia de seguridad restaurada (${imported} registros)`);
      } catch (err) {
        console.error('Error importing JSON:', err);
        showToast('Error al leer el archivo JSON');
      }
    };
    reader.readAsText(file);
  };

  // Sin sesión de Google autorizada no se muestra ni se lee nada
  if (!authReady) {
    return <div className="fixed inset-0 bg-[var(--bg-app)]" />;
  }
  if (!authToken) {
    return <AuthScreen deniedEmail={deniedEmail} />;
  }

  // Route Meta Configuration for Breadcrumbs & TopBar
  const getRouteMeta = () => {
    const { path, params } = currentRoute;

    if (path === '/agenda/tarea/:id' || path.startsWith('/agenda/tarea/')) {
      const id = params.id || path.replace('/agenda/tarea/', '');
      const task = tasks.find(t => t.id === id);
      return {
        title: task ? task.title : 'Detalle de Tarea',
        subtitle: task?.projectName ? `Estudio: ${task.projectName}` : 'Tarea de la Agenda',
        breadcrumbs: [
          { label: 'Agenda', path: '/agenda' },
          { label: task ? task.title : 'Tarea' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path === '/agenda/reunion/:id' || path.startsWith('/agenda/reunion/')) {
      const id = params.id || path.replace('/agenda/reunion/', '');
      const meeting = meetings.find(m => m.id === id);
      return {
        title: meeting ? meeting.title : 'Detalle de Reunión',
        subtitle: meeting?.time ? `Hora: ${meeting.time} hs` : 'Reunión agendada',
        breadcrumbs: [
          { label: 'Agenda', path: '/agenda' },
          { label: meeting ? meeting.title : 'Reunión' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path === '/clientes/nuevo') {
      return {
        title: 'Nuevo Cliente',
        subtitle: 'Alta guiada de estudio de arquitectura o proyecto web',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: 'Nuevo Estudio' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path.includes('/cobro/nuevo')) {
      const projId = path.split('/')[2];
      const project = projects.find(p => p.id === projId);
      return {
        title: 'Registrar Cobro',
        subtitle: project ? project.clientName : 'Nuevo pago recibido',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: project ? project.clientName : 'Cliente', path: `/clientes/${projId}` },
          { label: 'Registrar Cobro' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path.includes('/acuerdo')) {
      const projId = path.split('/')[2];
      const project = projects.find(p => p.id === projId);
      return {
        title: 'Acuerdo de Cobro',
        subtitle: project ? project.clientName : 'Configuración de cuotas y fechas',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: project ? project.clientName : 'Cliente', path: `/clientes/${projId}` },
          { label: 'Acuerdo' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path === '/clientes/:id' || (path.startsWith('/clientes/') && path !== '/clientes/paf' && path !== '/clientes/web')) {
      const id = params.id || path.replace('/clientes/', '');
      const project = projects.find(p => p.id === id);
      return {
        title: project ? project.clientName : 'Ficha 360°',
        subtitle: project ? (project.serviceType === 'paf' ? 'Programa de Acompañamiento Financiero' : 'Desarrollo Web') : 'Estudio de Arquitectura',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: project ? project.clientName : 'Ficha 360°' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path === '/clientes/paf') {
      return {
        title: 'Método PAF · Acompañamiento Financiero',
        subtitle: 'Gestión detallada de estudios de arquitectura, horas y cuotas',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: 'Método PAF' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/clientes/web') {
      return {
        title: 'Desarrollo Web · Sitios & Branding',
        subtitle: 'Proyectos web simples para arquitectos: precio, instancias y tareas',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: 'Desarrollo Web' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/horizonte' || path === '/horizon') {
      return {
        title: 'Horizonte · Línea de Tiempo & Capacidad',
        subtitle: 'Visión de largo plazo, ocupación mensual y reparto por frentes',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: 'Horizonte' },
        ],
        showBackButton: true,
        onBack: () => navigate('/clientes'),
      };
    }

    if (path === '/prospeccion') {
      return {
        title: 'Prospección',
        subtitle: 'Contactos en frío, seguimientos y auditorías',
        breadcrumbs: [{ label: 'Prospección' }],
        showBackButton: false,
      };
    }

    if (path === '/clientes') {
      return {
        title: 'Clientes & Estudios',
        subtitle: 'Cartera activa, pipeline y visión general',
        breadcrumbs: [
          { label: 'Clientes & Proyectos' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/calendario' || path === '/calendar') {
      return {
        title: 'Calendario 360°',
        subtitle: 'Cobros, tareas, reuniones, entregas e hitos centralizados',
        breadcrumbs: [
          { label: 'Calendario 360°' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/finanzas') {
      return {
        title: 'Finanzas & Cashflow',
        subtitle: 'Ingresos, egresos, balance neto y proyección a 90 días',
        breadcrumbs: [
          { label: 'Finanzas' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/gastos-fijos' || path === '/vencimientos' || path === '/suscripciones' || path === '/dominios') {
      return {
        title: 'Gastos Fijos & Vencimientos',
        subtitle: 'Hosting, Dominios de clientes e Inversión mensual en IAs',
        breadcrumbs: [
          { label: 'Dinero', path: '/dinero' },
          { label: 'Gastos Fijos & Vencimientos' },
        ],
        showBackButton: true,
        onBack: () => navigate('/dinero'),
      };
    }

    if (path === '/ayuda') {
      return {
        title: 'Ayuda & Método PAF',
        subtitle: 'Guía de objeciones, honorarios de referencia y atajos de teclado',
        breadcrumbs: [
          { label: 'Ayuda & Guías' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/grafo' || path === '/graph') {
      return {
        title: 'Grafo de Conocimiento',
        subtitle: 'Red visual interactiva de notas, proyectos y tareas con simulación física',
        breadcrumbs: [
          { label: 'Grafo' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/notas') {
      return {
        title: 'Notas & Documentación',
        subtitle: 'Editor de notas conectadas con enlaces [[...]] y backlinks',
        breadcrumbs: [
          { label: 'Notas' },
        ],
        showBackButton: false,
      };
    }

    if (path === '/segundo-cerebro' || path === '/brain') {
      return {
        title: 'Segundo Cerebro',
        subtitle: 'Notas interconectadas, grafo visual y gestión del conocimiento',
        breadcrumbs: [
          { label: 'Segundo Cerebro' },
        ],
        showBackButton: false,
      };
    }

    // Mis Finanzas Personales
    if (path.startsWith('/mis-finanzas')) {
      if (path === '/mis-finanzas/nuevo') {
        return {
          title: 'Carga Rápida de Finanzas',
          subtitle: 'Registrar movimiento en menos de 5 segundos',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Nuevo Movimiento' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/movimientos') {
        return {
          title: 'Historial de Movimientos',
          subtitle: 'Entradas, salidas y transferencias personales',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Movimientos' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/cuentas') {
        return {
          title: 'Cuentas & Billeteras',
          subtitle: 'Gestión de saldos y distribución de activos',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Cuentas' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/presupuestos') {
        return {
          title: 'Presupuestos por Categoría',
          subtitle: 'Límites mensuales de gasto y control semáforo',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Presupuestos' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/metas') {
        return {
          title: 'Metas de Ahorro',
          subtitle: 'Objetivos de acumulación y ritmo estimado',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Metas' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/estudio') {
        return {
          title: 'Inversión en Estudio & Formación',
          subtitle: 'Cursos, libros, software, horas dedicadas y ROI',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Estudio' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/recurrentes') {
        return {
          title: 'Suscripciones & Gastos Fijos',
          subtitle: 'Pagos periódicos y confirmación con un toque',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Recurrentes' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      if (path === '/mis-finanzas/ajustes') {
        return {
          title: 'Ajustes de Finanzas Personales',
          subtitle: 'Cotización dólar, PIN de seguridad, CSV y Scriptable iOS',
          breadcrumbs: [{ label: 'Mis Finanzas', path: '/mis-finanzas' }, { label: 'Ajustes' }],
          showBackButton: true,
          onBack: () => navigate('/mis-finanzas'),
        };
      }
      return {
        title: 'Mis Finanzas Personales',
        subtitle: 'Patrimonio en ARS y USD, balances y estudio',
        breadcrumbs: [{ label: 'Mis Finanzas' }],
        showBackButton: false,
      };
    }

    if (path.includes('/cobro/nuevo')) {
      const projId = path.split('/')[2];
      const p = projects.find(proj => proj.id === projId);
      return {
        title: 'Registrar Cobro',
        subtitle: p ? `Ingreso para ${p.clientName}` : 'Registrar cobro de cliente',
        breadcrumbs: [
          { label: 'Clientes', path: '/clientes' },
          { label: p?.clientName || 'Cliente', path: `/clientes/${projId}` },
          { label: 'Nuevo Cobro' },
        ],
        showBackButton: true,
        onBack: () => goBack(),
      };
    }

    if (path === '/dinero') {
      return {
        title: 'Dinero',
        subtitle: 'Finanzas del Estudio & Personales',
        breadcrumbs: [{ label: 'Dinero' }],
        showBackButton: false,
      };
    }

    if (path === '/cerebro') {
      return {
        title: 'Segundo Cerebro',
        subtitle: 'Notas, documentación conectada y grafo de conocimiento',
        breadcrumbs: [{ label: 'Cerebro' }],
        showBackButton: false,
      };
    }

    if (path.startsWith('/ajustes')) {
      const isSub = path !== '/ajustes';
      return {
        title: 'Ajustes',
        subtitle: 'Configuración, datos del estudio y preferencias',
        breadcrumbs: isSub ? [{ label: 'Ajustes', path: '/ajustes' }, { label: 'Sección' }] : [{ label: 'Ajustes' }],
        showBackButton: isSub,
        onBack: isSub ? () => navigate('/ajustes') : undefined,
      };
    }

    if (path.startsWith('/semana') || path.startsWith('/misiones') || path === '/semanal') {
      const isDetail = path.startsWith('/semana/mision/') || (path.startsWith('/semana/') && path !== '/semana');
      return {
        title: isDetail ? 'Misión de la Semana' : 'Misiones de la Semana',
        subtitle: isDetail ? 'Objetivo, pasos clave, sub-tareas y registro de horas' : 'Carriles, avance, capacidad vs. compromiso y ritmo',
        breadcrumbs: isDetail 
          ? [{ label: 'Semana', path: '/semana' }, { label: 'Detalle de Misión' }]
          : [{ label: 'Semana' }],
        showBackButton: isDetail,
        onBack: isDetail ? () => navigate('/semana') : undefined,
      };
    }

    if (path === '/inicio') {
      return {
        title: 'Inicio',
        subtitle: 'Elegí el sector del estudio',
        breadcrumbs: [{ label: 'Inicio' }],
        showBackButton: false,
      };
    }

    if (path === '/hoy' || path === '/') {
      return {
        title: 'Hoy',
        subtitle: 'Centro de mando y prioridades del día',
        breadcrumbs: [{ label: 'Hoy' }],
        showBackButton: false,
      };
    }

    return {
      title: 'Agenda Semanal',
      subtitle: 'Prioridades diarias, entregas y reuniones',
      breadcrumbs: [
        { label: 'Agenda Personal' },
      ],
      showBackButton: false,
    };
  };

  const routeMeta = getRouteMeta();

  // Dynamic View Renderer based on Path
  const renderCurrentRouteView = () => {
    const { path, params } = currentRoute;

    // 1. Task or Meeting Detail
    if (path === '/agenda/tarea/:id' || path.startsWith('/agenda/tarea/')) {
      const taskId = params.id || path.replace('/agenda/tarea/', '');
      return (
        <TaskDetailView
          itemId={taskId}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          onBack={() => goBack()}
          onNavigateToProject={(projId) => navigate(`/clientes/${projId}`)}
          onToggleTask={handleToggleTask}
          onToggleMeeting={handleToggleMeeting}
          onMoveTaskDate={handleMoveTaskDate}
          onMoveMeetingDate={handleMoveMeetingDate}
          onDeleteTask={handleDeleteTask}
          onDeleteMeeting={handleDeleteMeeting}
          onUpdateTask={handleUpdateTask}
          onUpdateMeeting={handleUpdateMeeting}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
        />
      );
    }

    if (path === '/agenda/reunion/:id' || path.startsWith('/agenda/reunion/')) {
      const meetingId = params.id || path.replace('/agenda/reunion/', '');
      return (
        <TaskDetailView
          itemId={meetingId}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          onBack={() => goBack()}
          onNavigateToProject={(projId) => navigate(`/clientes/${projId}`)}
          onToggleTask={handleToggleTask}
          onToggleMeeting={handleToggleMeeting}
          onMoveTaskDate={handleMoveTaskDate}
          onMoveMeetingDate={handleMoveMeetingDate}
          onDeleteTask={handleDeleteTask}
          onDeleteMeeting={handleDeleteMeeting}
          onUpdateTask={handleUpdateTask}
          onUpdateMeeting={handleUpdateMeeting}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
        />
      );
    }

    // 2. New Client Wizard
    if (path === '/clientes/nuevo') {
      return (
        <NewClientWizardView
          onBack={() => goBack()}
          onAddProject={handleAddProject}
          onNavigateToProject={(newId) => navigate(`/clientes/${newId}`)}
          onAddIncome={handleAddIncome}
          personalAccounts={personalAccounts}
        />
      );
    }

    // 2.5 New Payment dedicated screen
    if (path.includes('/cobro/nuevo')) {
      const projId = path.split('/')[2];
      const project = projects.find(p => p.id === projId);
      if (!project) {
        return (
          <div className="py-16 text-center space-y-4">
            <p className="text-zinc-400 text-sm">Cliente o proyecto no encontrado.</p>
            <button
              onClick={() => navigate('/clientes')}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              Volver a Clientes
            </button>
          </div>
        );
      }
      const q = currentRoute.query || {};
      const prefillCuotaId = q.cuotaId;
      const prefillAmount = q.monto ? Number(q.monto) : undefined;
      const prefillTitle = q.titulo ? decodeURIComponent(q.titulo) : undefined;

      return (
        <NewPaymentView
          project={project}
          incomes={incomes}
          personalAccounts={personalAccounts}
          usdRate={effectiveUsdRate}
          privacyMode={privacyMode}
          prefillCuotaId={prefillCuotaId}
          prefillAmount={prefillAmount}
          prefillTitle={prefillTitle}
          onSavePayment={(pId, payment, opts) => {
            handleSaveProjectPayment(pId, payment, opts);
            showToast('Cobro registrado exitosamente');
            navigate(`/clientes/${pId}`);
          }}
          onBack={() => goBack()}
        />
      );
    }

    // 2.6 Agreement Editor dedicated route
    if (path.includes('/acuerdo')) {
      const projId = path.split('/')[2];
      const project = projects.find(p => p.id === projId);
      if (!project) {
        return (
          <div className="py-16 text-center space-y-4">
            <p className="text-zinc-400 text-sm">Cliente o proyecto no encontrado.</p>
            <button
              onClick={() => navigate('/clientes')}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              Volver a Clientes
            </button>
          </div>
        );
      }
      return (
        <AgreementEditorView
          project={project}
          incomes={incomes}
          privacyMode={privacyMode}
          onBack={() => goBack()}
          onSaveAgreement={(updatedAgreement) => {
            handleUpdateProject(project.id, {
              billingAgreement: updatedAgreement,
              montoAcordado: updatedAgreement.totalAmount,
              estimatedPrice: updatedAgreement.totalAmount,
              estimatedCurrency: updatedAgreement.currency,
              installments: updatedAgreement.installments.map(u => ({
                id: u.id,
                number: u.number,
                totalInstallments: u.totalInstallments,
                dueDate: u.dueDate,
                amount: u.expectedAmount,
                currency: u.currency,
                status: u.status === 'pagado_a_tiempo' || u.status === 'pagado_tarde' ? 'cobrado' : (u.status === 'vencido' ? 'atrasado' : 'pendiente'),
                paid: u.actualPaidAmount >= u.expectedAmount,
                paidAt: u.paidAt,
                note: u.title,
                incomeRecordId: u.incomeRecordId,
              })),
            });
            showToast('Acuerdo de cobro actualizado');
            goBack();
          }}
        />
      );
    }

    // 3. Client 360 Detail
    if (path === '/clientes/:id' || (path.startsWith('/clientes/') && path !== '/clientes/paf' && path !== '/clientes/web')) {
      const projId = params.id || path.replace('/clientes/', '');
      const project = projects.find(p => p.id === projId);
      if (!project) {
        return (
          <div className="py-16 text-center space-y-4">
            <p className="text-zinc-400 text-sm">Cliente o proyecto no encontrado.</p>
            <button
              onClick={() => navigate('/clientes')}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              Volver a Clientes
            </button>
          </div>
        );
      }
      return (
        <ClientDetailView
          project={project}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          expenses={expenses}
          timeLogs={timeLogs}
          onBack={() => goBack()}
          onUpdateProject={handleUpdateProject}
          onToggleArchive={handleToggleArchiveProject}
          onDeleteProject={(id) => {
            handleDeleteProject(id);
            navigate('/clientes');
          }}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onAddMeeting={handleAddMeeting}
          onToggleMeeting={handleToggleMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onAddIncome={handleAddIncome}
          onOpenQuickIncome={() => {
            setQuickAddModal({
              isOpen: true,
              type: 'ingreso',
              defaultDate: getTodayString(),
            });
          }}
          onAddTimeLog={handleAddTimeLog}
          onDeleteTimeLog={handleDeleteTimeLog}
          notes={notes}
          onNavigate={(p) => navigate(p)}
          privacyMode={privacyMode}
          personalTransactions={personalTransactions}
          personalAccounts={personalAccounts}
          studioSettings={studioPaymentSettings}
          usdRate={effectiveUsdRate}
          onSavePayment={handleSaveProjectPayment}
          onDeletePayment={handleDeleteProjectPayment}
          onOpenStudioPaymentSettings={() => setShowStudioPaymentSettingsModal(true)}
        />
      );
    }

    // 4. Clientes List (PAF or Web or All)
    if (path === '/clientes/paf') {
      return (
        <ProjectsSimpleView
          clients={clients}
          onUpdateClient={handleUpdateClient}
          serviceMode="paf"
          projects={projects}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          expenses={expenses}
          timeLogs={timeLogs}
          privacyMode={privacyMode}
          onAddTimeLog={handleAddTimeLog}
          onDeleteTimeLog={handleDeleteTimeLog}
          onAddProject={handleAddProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onToggleArchive={handleToggleArchiveProject}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onAddMeeting={handleAddMeeting}
          onToggleMeeting={handleToggleMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onAddIncome={handleAddIncome}
          onToggleIncomeStatus={(id) => {
            const inc = incomes.find(i => i.id === id);
            if (inc) {
              handleUpdateIncome(id, { status: inc.status === 'cobrado' ? 'pendiente' : 'cobrado' });
            }
          }}
          onDeleteIncome={handleDeleteIncome}
          onAddExpense={handleAddExpense}
          onToggleExpenseStatus={(id) => {
            const exp = expenses.find(e => e.id === id);
            if (exp) {
              handleUpdateExpense(id, { status: exp.status === 'pagado' ? 'pendiente' : 'pagado' });
            }
          }}
          onDeleteExpense={handleDeleteExpense}
          onNavigateToProject={(id) => navigate(`/clientes/${id}`)}
          onNavigateToNewClient={() => navigate('/clientes/nuevo')}
          onSavePayment={handleSaveProjectPayment}
          onDeletePayment={handleDeleteProjectPayment}
          personalAccounts={personalAccounts}
          usdRate={effectiveUsdRate}
        />
      );
    }

    if (path === '/clientes/web') {
      return (
        <ProjectsSimpleView
          clients={clients}
          onUpdateClient={handleUpdateClient}
          serviceMode="web"
          projects={projects}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          expenses={expenses}
          timeLogs={timeLogs}
          privacyMode={privacyMode}
          onAddTimeLog={handleAddTimeLog}
          onDeleteTimeLog={handleDeleteTimeLog}
          onAddProject={handleAddProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onToggleArchive={handleToggleArchiveProject}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onAddMeeting={handleAddMeeting}
          onToggleMeeting={handleToggleMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onAddIncome={handleAddIncome}
          onToggleIncomeStatus={(id) => {
            const inc = incomes.find(i => i.id === id);
            if (inc) {
              handleUpdateIncome(id, { status: inc.status === 'cobrado' ? 'pendiente' : 'cobrado' });
            }
          }}
          onDeleteIncome={handleDeleteIncome}
          onAddExpense={handleAddExpense}
          onToggleExpenseStatus={(id) => {
            const exp = expenses.find(e => e.id === id);
            if (exp) {
              handleUpdateExpense(id, { status: exp.status === 'pagado' ? 'pendiente' : 'pagado' });
            }
          }}
          onDeleteExpense={handleDeleteExpense}
          onNavigate={(p) => navigate(p)}
          onNavigateToProject={(id) => navigate(`/clientes/${id}`)}
          onNavigateToNewClient={() => navigate('/clientes/nuevo')}
          onSavePayment={handleSaveProjectPayment}
          onDeletePayment={handleDeleteProjectPayment}
          personalAccounts={personalAccounts}
          usdRate={effectiveUsdRate}
        />
      );
    }

    if (path === '/inicio') {
      return (
        <HomeView
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          incomes={incomes}
          notes={notes}
          pendingPayments={pendingMp.filter(p => p.direction !== 'enviado').length}
          privacyMode={privacyMode}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/prospeccion') {
      return <ProspectingView projects={projects} onAddProject={handleAddProject} />;
    }

    if (path === '/clientes') {
      return (
        <ProjectsSimpleView
          clients={clients}
          onUpdateClient={handleUpdateClient}
          serviceMode="all"
          projects={projects}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          expenses={expenses}
          timeLogs={timeLogs}
          privacyMode={privacyMode}
          onAddTimeLog={handleAddTimeLog}
          onDeleteTimeLog={handleDeleteTimeLog}
          onAddProject={handleAddProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onToggleArchive={handleToggleArchiveProject}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onAddMeeting={handleAddMeeting}
          onToggleMeeting={handleToggleMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onAddIncome={handleAddIncome}
          onToggleIncomeStatus={(id) => {
            const inc = incomes.find(i => i.id === id);
            if (inc) {
              handleUpdateIncome(id, { status: inc.status === 'cobrado' ? 'pendiente' : 'cobrado' });
            }
          }}
          onDeleteIncome={handleDeleteIncome}
          onAddExpense={handleAddExpense}
          onToggleExpenseStatus={(id) => {
            const exp = expenses.find(e => e.id === id);
            if (exp) {
              handleUpdateExpense(id, { status: exp.status === 'pagado' ? 'pendiente' : 'pagado' });
            }
          }}
          onDeleteExpense={handleDeleteExpense}
          onNavigate={(p) => navigate(p)}
          onNavigateToProject={(id) => navigate(`/clientes/${id}`)}
          onNavigateToNewClient={() => navigate('/clientes/nuevo')}
          onSavePayment={handleSaveProjectPayment}
          onDeletePayment={handleDeleteProjectPayment}
          personalAccounts={personalAccounts}
          usdRate={effectiveUsdRate}
        />
      );
    }

    // 4.5 Horizonte: Línea de tiempo de largo plazo & ocupación
    if (path === '/horizonte' || path === '/horizon') {
      return (
        <HorizonView
          projects={projects}
          incomes={incomes}
          expenses={expenses}
          usdRate={effectiveUsdRate}
          privacyMode={privacyMode}
          onNavigate={navigate}
          onBack={() => navigate('/clientes')}
          onAddProject={handleAddProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
        />
      );
    }

    // 5. Calendario 360°
    if (path === '/calendario' || path === '/calendar') {
      return (
        <CalendarView
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          incomes={incomes}
          studioFixedExpenses={studioFixedExpenses}
          privacyMode={privacyMode}
          onToggleTask={handleToggleTask}
          onToggleMeeting={handleToggleMeeting}
          onDeleteTask={handleDeleteTask}
          onDeleteMeeting={handleDeleteMeeting}
          onToggleIncomeStatus={(id) => {
            const inc = incomes.find(i => i.id === id);
            if (inc) {
              handleUpdateIncome(id, { status: inc.status === 'cobrado' ? 'pendiente' : 'cobrado' });
            }
          }}
          onOpenProject360={(p) => navigate(`/clientes/${p.id}`)}
          onOpenQuickAdd={(type, defaultDate) =>
            setQuickAddModal({
              isOpen: true,
              type: type || 'tarea',
              defaultDate: defaultDate || getTodayString(),
            })
          }
          onNavigate={(p) => navigate(p)}
        />
      );
    }

    // 6. Finanzas
    if (path === '/finanzas') {
      return (
        <IncomeView
          incomes={incomes}
          expenses={expenses}
          studioFixedExpenses={studioFixedExpenses}
          projects={projects}
          privacyMode={privacyMode}
          onAddIncome={handleAddIncome}
          onUpdateIncome={handleUpdateIncome}
          onDeleteIncome={handleDeleteIncome}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          onAddFixedExpense={handleAddStudioFixedExpense}
          onUpdateFixedExpense={handleUpdateStudioFixedExpense}
          onDeleteFixedExpense={handleDeleteStudioFixedExpense}
          onUpdateProject={handleUpdateProject}
          onOpenProject360={(p) => navigate(`/clientes/${p.id}`)}
          onSavePayment={handleSaveProjectPayment}
          onDeletePayment={handleDeleteProjectPayment}
          personalAccounts={personalAccounts}
          usdRate={effectiveUsdRate}
        />
      );
    }

    // 6.2 Gastos Fijos, Dominios, Hosting & IAs
    if (path === '/gastos-fijos' || path === '/vencimientos' || path === '/suscripciones' || path === '/dominios') {
      return (
        <div className="space-y-6">
          <StudioFixedExpensesSection
            expenses={studioFixedExpenses}
            projects={projects}
            usdRate={effectiveUsdRate}
            privacyMode={privacyMode}
            onAddFixedExpense={handleAddStudioFixedExpense}
            onUpdateFixedExpense={handleUpdateStudioFixedExpense}
            onDeleteFixedExpense={handleDeleteStudioFixedExpense}
            onRecordRealExpense={handleAddExpense}
          />
        </div>
      );
    }

    // 6. Ayuda & Atajos
    if (path === '/ayuda') {
      return <AyudaView privacyMode={privacyMode} />;
    }

    // 7. Grafo de Conocimiento (Simulación física Canvas con d3-force)
    if (path === '/grafo' || path === '/graph') {
      return (
        <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--text-tertiary)]">Cargando Grafo de Conocimiento…</div>}>
          <KnowledgeGraphView
            tasks={tasks}
            meetings={meetings}
            projects={projects}
            incomes={incomes}
            expenses={expenses}
            weeklyGoals={weeklyGoals}
            notes={notes}
            personalTransactions={personalTransactions}
            onNavigate={(p) => navigate(p)}
            privacyMode={privacyMode}
          />
        </React.Suspense>
      );
    }

    // 8. Notas & Documentación Conectada (con [[Links]] y Backlinks)
    if (path === '/notas') {
      return (
        <NotesView
          notes={notes}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          weeklyGoals={weeklyGoals}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onNavigate={(p) => navigate(p)}
          privacyMode={privacyMode}
          initialNoteId={params.id}
        />
      );
    }

    // 9. Segundo Cerebro (Vista alternativa)
    if (path === '/segundo-cerebro' || path === '/brain') {
      return (
        <SecondBrainView
          tasks={tasks}
          projects={projects}
          weeklyGoals={weeklyGoals}
          notes={notes}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onToggleTask={handleToggleTask}
          onNavigate={(p) => navigate(p)}
        />
      );
    }

    // 10. Mis Finanzas Personales & Estudio
    if (path.startsWith('/mis-finanzas')) {
      const renderSubView = () => {
        if (path === '/mis-finanzas/nuevo') {
          return (
            <PersonalFinanceQuickAddView
              accounts={personalAccounts}
              categories={personalCategories}
              projects={projects}
              settings={effectivePersonalSettings}
              onSaveTransaction={handleSavePersonalTransaction}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/movimientos') {
          return (
            <PersonalFinanceTransactionsView
              transactions={personalTransactions}
              accounts={personalAccounts}
              categories={personalCategories}
              projects={projects}
              privacyMode={privacyMode}
              onUpdateTransaction={handleUpdatePersonalTransaction}
              onDeleteTransaction={handleDeletePersonalTransaction}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/cuentas') {
          return (
            <PersonalFinanceAccountsView
              accounts={personalAccounts}
              transactions={personalTransactions}
              privacyMode={privacyMode}
              onSaveAccount={handleSavePersonalAccount}
              onUpdateAccount={handleUpdatePersonalAccount}
              onDeleteAccount={handleDeletePersonalAccount}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/presupuestos') {
          return (
            <PersonalFinanceBudgetsView
              budgets={personalBudgets}
              categories={personalCategories}
              transactions={personalTransactions}
              settings={effectivePersonalSettings}
              privacyMode={privacyMode}
              onSaveBudget={handleSavePersonalBudget}
              onUpdateBudget={handleUpdatePersonalBudget}
              onDeleteBudget={handleDeletePersonalBudget}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/metas') {
          return (
            <PersonalFinanceGoalsView
              goals={savingsGoals}
              transactions={personalTransactions}
              settings={effectivePersonalSettings}
              privacyMode={privacyMode}
              onSaveGoal={handleSaveSavingsGoal}
              onUpdateGoal={handleUpdateSavingsGoal}
              onDeleteGoal={handleDeleteSavingsGoal}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/estudio') {
          return (
            <PersonalFinanceStudyView
              studyItems={studyItems}
              projects={projects}
              timeLogs={timeLogs}
              privacyMode={privacyMode}
              usdRate={effectiveUsdRate}
              onSaveStudyItem={handleSaveStudyItem}
              onUpdateStudyItem={handleUpdateStudyItem}
              onDeleteStudyItem={handleDeleteStudyItem}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/recurrentes') {
          return (
            <PersonalFinanceRecurringView
              recurrings={personalRecurrings}
              accounts={personalAccounts}
              categories={personalCategories}
              privacyMode={privacyMode}
              usdRate={effectiveUsdRate}
              onSaveRecurring={handleSavePersonalRecurring}
              onUpdateRecurring={handleUpdatePersonalRecurring}
              onDeleteRecurring={handleDeletePersonalRecurring}
              onConfirmRecurring={handleConfirmPersonalRecurring}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        if (path === '/mis-finanzas/ajustes') {
          return (
            <PersonalFinanceSettingsView
              settings={effectivePersonalSettings}
              accounts={personalAccounts}
              categories={personalCategories}
              transactions={personalTransactions}
              goals={savingsGoals}
              onSaveSettings={handleSavePersonalFinanceSettings}
              onNavigate={(p) => navigate(p)}
            />
          );
        }
        // Default overview (/mis-finanzas)
        return (
          <PersonalFinanceOverviewView
            accounts={personalAccounts}
            categories={personalCategories}
            transactions={personalTransactions}
            recurrings={personalRecurrings}
            budgets={personalBudgets}
            settings={effectivePersonalSettings}
            incomes={incomes}
            privacyMode={privacyMode}
            onNavigate={(p) => navigate(p)}
            onConfirmRecurring={handleConfirmPersonalRecurring}
          />
        );
      };

      return (
        <PersonalFinanceLayout
          currentPath={path}
          onNavigate={(p) => navigate(p)}
          accounts={personalAccounts}
          categories={personalCategories}
          transactions={personalTransactions}
          recurrings={personalRecurrings}
          budgets={personalBudgets}
          goals={savingsGoals}
          studyItems={studyItems}
          settings={effectivePersonalSettings}
          projects={projects}
          incomes={incomes}
          timeLogs={timeLogs}
          privacyMode={privacyMode}
          onTogglePrivacy={handleTogglePrivacy}
          onSaveSettings={handleSavePersonalFinanceSettings}
        >
          {renderSubView()}
        </PersonalFinanceLayout>
      );
    }

    // 11. Dinero Unified
    if (path === '/dinero') {
      const mode = currentRoute.query?.modo === 'personal' ? 'personal' : 'estudio';
      return (
        <DineroUnifiedView
          initialMode={mode}
          incomes={incomes}
          expenses={expenses}
          studioFixedExpenses={studioFixedExpenses}
          projects={projects}
          timeLogs={timeLogs}
          personalAccounts={personalAccounts}
          personalCategories={personalCategories}
          personalTransactions={personalTransactions}
          personalRecurrings={personalRecurrings}
          personalBudgets={personalBudgets}
          personalSavingsGoals={savingsGoals}
          personalStudyItems={studyItems}
          personalSettings={effectivePersonalSettings}
          privacyMode={privacyMode}
          usdRate={effectiveUsdRate}
          onAddIncome={handleAddIncome}
          onUpdateIncome={handleUpdateIncome}
          onDeleteIncome={handleDeleteIncome}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          onAddFixedExpense={handleAddStudioFixedExpense}
          onUpdateFixedExpense={handleUpdateStudioFixedExpense}
          onDeleteFixedExpense={handleDeleteStudioFixedExpense}
          onUpdateProject={handleUpdateProject}
          onOpenProject360={(p) => navigate(`/clientes/${p.id}`)}
          onSavePayment={handleSaveProjectPayment}
          onDeletePayment={handleDeleteProjectPayment}
          onSavePersonalTransaction={handleSavePersonalTransaction}
          onUpdatePersonalTransaction={handleUpdatePersonalTransaction}
          onDeletePersonalTransaction={handleDeletePersonalTransaction}
          onSavePersonalAccount={handleSavePersonalAccount}
          onUpdatePersonalAccount={handleUpdatePersonalAccount}
          onDeletePersonalAccount={handleDeletePersonalAccount}
          onSavePersonalBudget={handleSavePersonalBudget}
          onUpdatePersonalBudget={handleUpdatePersonalBudget}
          onDeletePersonalBudget={handleDeletePersonalBudget}
          onSavePersonalRecurring={handleSavePersonalRecurring}
          onUpdatePersonalRecurring={handleUpdatePersonalRecurring}
          onDeletePersonalRecurring={handleDeletePersonalRecurring}
          onConfirmPersonalRecurring={handleConfirmPersonalRecurring}
          onSavePersonalSavingsGoal={handleSaveSavingsGoal}
          onUpdatePersonalSavingsGoal={handleUpdateSavingsGoal}
          onDeletePersonalSavingsGoal={handleDeleteSavingsGoal}
          onSavePersonalStudyItem={handleSaveStudyItem}
          onUpdatePersonalStudyItem={handleUpdateStudyItem}
          onDeletePersonalStudyItem={handleDeleteStudyItem}
          onNavigate={navigate}
          onOpenQuickAdd={(type?: any, defaultDate?: string) => {
            const validTypes: QuickAddType[] = ['tarea', 'reunion', 'proyecto', 'ingreso', 'gasto', 'objetivo'];
            const cleanType = typeof type === 'string' && validTypes.includes(type as any) ? (type as QuickAddType) : 'ingreso';
            setQuickAddModal({
              isOpen: true,
              type: cleanType,
              defaultDate: defaultDate || getTodayString(),
            });
          }}
        />
      );
    }

    // 12. Cerebro Unified
    if (path === '/cerebro') {
      const tab = (currentRoute.query?.tab as 'inicio' | 'notas' | 'grafo') || 'inicio';
      return (
        <CerebroUnifiedView
          initialTab={tab}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          incomes={incomes}
          expenses={expenses}
          weeklyGoals={weeklyGoals}
          notes={notes}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onToggleTask={handleToggleTask}
          onNavigate={navigate}
        />
      );
    }

    // 13. Ajustes
    if (path.startsWith('/ajustes')) {
      const sub = currentRoute.params?.seccion || path.replace('/ajustes/', '');
      return (
        <AjustesView
          subSection={sub !== '/ajustes' ? sub : undefined}
          studioSettings={studioPaymentSettings}
          onUpdateStudioSettings={(s) => {
            setStudioPaymentSettings(s);
            saveStoredStudioPaymentSettings(s);
            showToast('Datos de cobro del estudio actualizados');
          }}
          personalSettings={effectivePersonalSettings}
          onUpdatePersonalSettings={handleSavePersonalFinanceSettings}
          privacyMode={privacyMode}
          onTogglePrivacy={handleTogglePrivacy}
          syncStatus={syncStatus}
          onForceSync={handleForceSync}
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
          onImportJSON={handleImportJSON}
          onResetDatabase={handleResetDatabase}
          onLockSession={handleLockSession}
          onRepairTaskLinks={() => setShowRepairLinksModal(true)}
          onRestoreTrashItem={(item: TrashItem) => {
            try {
              if (item.itemType === 'tarea') {
                handleAddTask(item.data);
              } else if (item.itemType === 'reunion') {
                handleAddMeeting(item.data);
              } else if (item.itemType === 'cliente' || (item.itemType as any) === 'proyecto') {
                handleAddProject(item.data);
              } else if (item.itemType === 'ingreso') {
                handleAddIncome(item.data);
              } else if (item.itemType === 'gasto') {
                handleAddExpense(item.data);
              } else if (item.itemType === 'nota') {
                handleAddNote(item.data);
              } else if (item.itemType === 'movimiento_personal') {
                handleSavePersonalTransaction(item.data);
              }
              purgeTrashRecord(item.id);
              showToast(`${item.title} restaurado con éxito`);
            } catch (err) {
              console.error('Error restaurando elemento:', err);
            }
          }}
          onNavigate={navigate}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      );
    }

    // 14. Misiones de la Semana (/semana)
    if (path.startsWith('/semana') || path.startsWith('/misiones') || path === '/semanal') {
      const missionIdMatch = currentRoute.params?.id || (path.startsWith('/semana/mision/') ? path.replace('/semana/mision/', '') : (path.startsWith('/semana/') && path !== '/semana' ? path.replace('/semana/', '') : undefined));
      return (
        <SemanaView
          missions={weeklyGoals}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          incomes={incomes}
          onSaveMission={handleSaveWeeklyMission}
          onDeleteMission={handleDeleteWeeklyMission}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onNavigate={navigate}
          selectedMissionId={missionIdMatch}
        />
      );
    }

    // Default: /agenda or /hoy
    return (
      <AgendaView
        tasks={tasks}
        meetings={meetings}
        projects={projects}
        incomes={incomes}
        weeklyGoals={weeklyGoals}
        weeklyMissions={weeklyGoals}
        privacyMode={privacyMode}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onToggleMeeting={handleToggleMeeting}
        onMoveTaskDate={handleMoveTaskDate}
        onMoveMeetingDate={handleMoveMeetingDate}
        onDeleteTask={handleDeleteTask}
        onDeleteMeeting={handleDeleteMeeting}
        onDeleteProject={handleDeleteProject}
        onUpdateProject={handleUpdateProject}
        onAddIncome={handleAddIncome}
        onUpdateTask={handleUpdateTask}
        onReorderTasks={handleReorderTasks}
        onUpdateMeeting={handleUpdateMeeting}
        onToggleSubtask={handleToggleSubtask}
        onAddSubtask={handleAddSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onAddWeeklyGoal={handleAddWeeklyGoal}
        onToggleWeeklyGoal={handleToggleWeeklyGoal}
        onUpdateWeeklyGoal={handleUpdateWeeklyGoal}
        onDeleteWeeklyGoal={handleDeleteWeeklyGoal}
        onNavigateToCalendar={() => navigate('/calendario')}
        onOpenQuickAdd={(type, defaultDate) =>
          setQuickAddModal({
            isOpen: true,
            type,
            defaultDate: defaultDate || getTodayString(),
          })
        }
        onOpenItemDetail={(id, type) => {
          navigate(`/agenda/${type}/${id}`);
        }}
        onNavigate={navigate}
        studioSettings={studioPaymentSettings}
        personalAccounts={personalAccounts}
        usdRate={effectiveUsdRate}
        onSavePayment={handleSaveProjectPayment}
        onDeletePayment={handleDeleteProjectPayment}
      />
    );
  };

  // Modo Foco: Pantalla completa sin sidebar ni barra inferior
  if (currentRoute.path === '/foco') {
    return (
      <FocusView
        tasks={tasks}
        meetings={meetings}
        projects={projects}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onToggleTask={handleToggleTask}
        onToggleMeeting={handleToggleMeeting}
        onMoveTaskDate={handleMoveTaskDate}
        onDeleteTask={handleDeleteTask}
        onAddTimeLog={handleAddTimeLog}
        onExit={() => navigate('/agenda')}
      />
    );
  }

  return (
    <div className="h-screen h-[100dvh] w-full max-w-full flex overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {/* Desktop Sidebar (hidden on mobile) */}
      <DesktopSidebar
        currentPath={currentRoute.path}
        onNavigate={navigate}
        onOpenQuickAdd={(type) => {
          const validTypes: QuickAddType[] = ['tarea', 'reunion', 'proyecto', 'ingreso', 'gasto', 'objetivo'];
          const cleanType = typeof type === 'string' && validTypes.includes(type as any) ? (type as QuickAddType) : 'tarea';
          setQuickAddModal({
            isOpen: true,
            type: cleanType,
            defaultDate: getTodayString(),
          });
        }}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenShortcuts={() => setShowKeyboardShortcuts(true)}
        onOpenPomodoro={() => setShowPomodoroModal(true)}
        onOpenPafGuide={() => setShowPafGuideModal(true)}
        onOpenGeminiChat={() => setShowGeminiChat(true)}
        onLockSession={handleLockSession}
        syncStatus={syncStatus}
        projects={projects}
        tasks={tasks}
        meetings={meetings}
        incomes={incomes}
        expenses={expenses}
        privacyMode={privacyMode}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area with Dynamic AppTopBar */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden w-full max-w-full overscroll-x-none bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors">
        <AppTopBar
          title={routeMeta.title}
          subtitle={routeMeta.subtitle}
          breadcrumbs={routeMeta.breadcrumbs}
          showBackButton={routeMeta.showBackButton}
          onBack={routeMeta.onBack}
          onNavigate={navigate}
          syncStatus={syncStatus}
          privacyMode={privacyMode}
          onTogglePrivacy={handleTogglePrivacy}
          soundEnabled={soundActive}
          onToggleSound={handleToggleSound}
          onLockSession={handleLockSession}
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
          onImportJSON={handleImportJSON}
          onResetDatabase={handleResetDatabase}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenRepairTaskLinks={() => setShowRepairLinksModal(true)}
          onOpenIosWidgets={() => setShowIosWidgetsModal(true)}
          onOpenPomodoro={() => setShowPomodoroModal(true)}
          onOpenGeminiChat={() => setShowGeminiChat(true)}
          onForceSync={handleForceSync}
          onOpenPafPricing={() => setShowPafPricingModal(true)}
          onOpenStudioPaymentSettings={() => setShowStudioPaymentSettingsModal(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main 
          id="contenido"
          tabIndex={-1}
          key={currentRoute.path} 
          className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 pb-28 md:pb-12 min-w-0 overflow-x-hidden max-w-full"
        >
          {['agenda', 'hoy', 'dinero', 'finanzas'].includes(currentRoute.name) && (
            <MercadoPagoInbox
              pending={pendingMp}
              privacyMode={privacyMode}
              onRegister={setMpToRegister}
              onRegisterSent={handleMpSentAsExpense}
              onIgnore={p => handleMpDismiss(p.id)}
            />
          )}
          <React.Suspense fallback={<RouteLoading />}>
            {/* Animación entre pantallas (ver index.css): adelante/atrás desliza, lateral funde.
                Sin tipo (la pantalla terminó de cargar) aparece con un fundido. */}
            <ViewTransition
              key={currentRoute.path}
              enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', 'nav-lateral': 'fade-in', default: 'fade-in' }}
              exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', 'nav-lateral': 'fade-out', default: 'none' }}
              default="none"
            >
              <div>{renderCurrentRouteView()}</div>
            </ViewTransition>
          </React.Suspense>
        </main>
      </div>

      <MercadoPagoReconcileModal
        key={mpToRegister?.id || 'ninguno'}
        isOpen={Boolean(mpToRegister)}
        onClose={() => setMpToRegister(null)}
        payment={mpToRegister}
        projects={projects}
        personalAccounts={personalAccounts}
        usdRate={effectiveUsdRate}
        onReconcileAsProjectPayment={handleMpAsProjectPayment}
        onReconcileAsStudioIncome={handleMpAsStudioIncome}
        onReconcileAsPersonalTransaction={handleMpAsPersonal}
        onDismissPayment={handleMpDismiss}
      />

      <MercadoPagoPaymentAlert
        payment={mpToRegister ? null : mpAlert}
        remaining={Math.max(0, mpAlertQueue.length - 1)}
        privacyMode={privacyMode}
        onRegister={p => {
          markMpSeen(p.id);
          setMpToRegister(p);
        }}
        onLater={p => markMpSeen(p.id)}
      />

      {/* Discreet Toast Notification with Undo option (anunciado por lectores de pantalla) */}
      <div role="status" aria-live="polite" className="sr-only">{toast?.message || ''}</div>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-[#0A0A0A] text-[#FAFAFA] border border-[#262626] text-[11px] font-medium tracking-wide shadow-sm animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.medium();
                toast.onUndo?.();
                setToast(null);
              }}
              className="ml-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold text-[var(--accent)] hover:text-white hover:bg-zinc-800 transition cursor-pointer underline"
            >
              Deshacer
            </button>
          )}
        </div>
      )}

      {/* PWA Install Button (if eligible) */}
      <PWAInstallButton />

      {/* Mobile Bottom Navigation (auto-hides on detail screens) */}
      <MobileNav
        currentPath={currentRoute.path}
        onNavigate={navigate}
        onOpenQuickAdd={() =>
          setQuickAddModal({
            isOpen: true,
            type: 'tarea',
            defaultDate: getTodayString(),
          })
        }
      />

      {/* Global Command Palette (Cmd+K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        tasks={tasks}
        meetings={meetings}
        projects={projects}
        incomes={incomes}
        expenses={expenses}
        notes={notes}
        onNavigate={navigate}
        onSelectTab={(tab) => {
          if (tab === 'agenda') navigate('/agenda');
          else if (tab === 'calendario') navigate('/calendario');
          else if (tab === 'web') navigate('/clientes/web');
          else if (tab === 'paf') navigate('/clientes/paf');
          else if (tab === 'ingresos') navigate('/finanzas');
          else navigate('/clientes');
        }}
        onOpenProject360={(p) => {
          setShowCommandPalette(false);
          navigate(`/clientes/${p.id}`);
        }}
        onOpenQuickAdd={(type) => {
          setQuickAddModal({
            isOpen: true,
            type,
            defaultDate: getTodayString(),
          });
        }}
        onToggleTask={handleToggleTask}
        onToggleMeeting={handleToggleMeeting}
        theme={theme}
        onToggleTheme={toggleTheme}
        privacyMode={privacyMode}
        onTogglePrivacy={handleTogglePrivacy}
        soundEnabled={soundActive}
        onToggleSound={handleToggleSound}
        onExportCSV={handleExportCSV}
        onLockSession={handleLockSession}
        onOpenGeminiChat={() => setShowGeminiChat(true)}
        onOpenRepairTaskLinks={() => setShowRepairLinksModal(true)}
        onOpenIosWidgets={() => setShowIosWidgetsModal(true)}
      />

      {/* Floating Gemini Copilot Trigger Button (Swiss Monochrome with Indigo spark) */}
      {!showGeminiChat && (
        <button
          type="button"
          onClick={() => {
            hapticFeedback.medium();
            setShowGeminiChat(true);
          }}
          className="hidden md:flex fixed bottom-6 right-6 z-40 px-3.5 py-2 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border border-[var(--border-subtle)] text-xs font-medium shadow-sm items-center gap-2 transition cursor-pointer active:scale-95 group touch-manipulation hover:opacity-90"
          title="Copiloto Gemini (⌘J o 'g')"
        >
          <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform shrink-0" />
          <span className="hidden sm:inline">Copiloto IA</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--solid-contrast-text)]/15 font-mono">
            ⌘J
          </span>
        </button>
      )}

      {/* Gemini AI Copilot Drawer (Multi-turn Chat & Live App Actions) */}
      {copilotMounted && (
        <React.Suspense fallback={null}>
        <GeminiCopilotDrawer
          isOpen={showGeminiChat}
          onClose={() => setShowGeminiChat(false)}
          projects={projects}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          expenses={expenses}
          weeklyGoals={weeklyGoals}
          notes={notes}
          onAddTask={handleAddTask}
          onAddMeeting={handleAddMeeting}
          onAddIncome={handleAddIncome}
          onAddExpense={handleAddExpense}
          onAddProject={handleAddProject}
          onAddWeeklyGoal={handleAddWeeklyGoal}
          onAddNote={handleAddNote}
          onToggleTask={handleToggleTask}
          onToggleMeeting={handleToggleMeeting}
          onDeleteTask={handleDeleteTask}
          onNavigate={navigate}
          personalAccounts={personalAccounts}
          personalCategories={personalCategories}
          personalTransactions={personalTransactions}
          personalRecurrings={personalRecurrings}
          onAddPersonalTransaction={handleSavePersonalTransaction}
          onAddPersonalRecurring={handleSavePersonalRecurring}
        />
        </React.Suspense>
      )}

      {/* Global Keyboard Shortcuts Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />

      {/* Global Quick Add Modal */}
      <QuickAddModal
        isOpen={quickAddModal.isOpen}
        initialType={quickAddModal.type}
        initialDate={quickAddModal.defaultDate}
        projects={projects}
        missions={weeklyGoals}
        onClose={() => setQuickAddModal(prev => ({ ...prev, isOpen: false }))}
        onAddTask={handleAddTask}
        onAddMeeting={handleAddMeeting}
        onAddProject={handleAddProject}
        onAddIncome={handleAddIncome}
        onAddExpense={handleAddExpense}
        onAddWeeklyGoal={handleAddWeeklyGoal}
      />

      {/* Focus Pomodoro Timer Modal (#6) */}
      <PomodoroModal
        isOpen={showPomodoroModal}
        onClose={() => setShowPomodoroModal(false)}
        projects={projects}
        onAddTimeLog={handleAddTimeLog}
      />

      {/* Commercial & Sales Objections Guide Modal (Método PAF) */}
      <PafGuideModal
        isOpen={showPafGuideModal}
        onClose={() => setShowPafGuideModal(false)}
      />

      {/* PAF Pricing Configuration Modal */}
      <PafPricingConfigModal
        isOpen={showPafPricingModal}
        onClose={() => setShowPafPricingModal(false)}
      />

      {/* Repair Task-Project Links Modal (Paso 3) */}
      <RepairTaskLinksModal
        isOpen={showRepairLinksModal}
        onClose={() => setShowRepairLinksModal(false)}
        tasks={tasks}
        projects={projects}
        onTasksUpdated={(updatedTasks) => {
          setTasks(updatedTasks);
          saveStoredTasks(updatedTasks);
          showToast('Vínculos de tareas y proyectos sincronizados con éxito');
        }}
      />

      {/* iOS Widgets & Apple Shortcuts Hub Modal */}
      {iosWidgetsMounted && (
        <React.Suspense fallback={null}>
        <IosWidgetsModal
          isOpen={showIosWidgetsModal}
          onClose={() => setShowIosWidgetsModal(false)}
          tasks={tasks}
          meetings={meetings}
          projects={projects}
          incomes={incomes}
          onOpenQuickAdd={(type) => {
            setShowIosWidgetsModal(false);
            setQuickAddModal({
              isOpen: true,
              type,
              defaultDate: getTodayString(),
            });
          }}
          onNavigate={navigate}
          onToggleTask={handleToggleTask}
        />
        </React.Suspense>
      )}

      {/* Studio Payment / Bank Settings Modal */}
      <StudioPaymentSettingsModal
        isOpen={showStudioPaymentSettingsModal}
        onClose={() => setShowStudioPaymentSettingsModal(false)}
        settings={studioPaymentSettings}
        onSave={handleSaveStudioPaymentSettings}
      />

      {/* Reset Database Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">¿Vaciar base de datos a 0?</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Se eliminarán permanentemente todas las tareas, reuniones, proyectos, ingresos y gastos de Firebase y la nube quedará totalmente limpia.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResetDatabase}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-600/25 flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, reiniciar a 0</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
