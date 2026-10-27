// Types for .Cero CRM v3 - Minimalist 4-Module Architecture + Sync

export type ViewTab = 'agenda' | 'calendario' | 'web' | 'paf' | 'ingresos' | 'proyectos';

// 1. Agenda (Planificador 7 días)
export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt?: string;
}

// Nueva estructura subtarea para Modo Foco (compatible con SubTask)
export interface SubtareaFoco {
  id: string;
  titulo: string;
  hecha: boolean;
}

export type TaskPriority = 'alta' | 'media' | 'baja';

export type TaskRecurrencePreset = 'diaria' | 'habiles' | 'semanal' | 'quincenal' | 'mensual';
export interface TaskRecurrence {
  preset: TaskRecurrencePreset;
  monthDay?: number; // para "mensual": el día del mes original (ej. 31 → último día en meses cortos)
}

export interface AgendaTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM opcional
  completed: boolean;
  completedAt?: string | null; // YYYY-MM-DD del día en que se terminó (para el mapa de constancia)
  recurrence?: TaskRecurrence | null; // si se repite: al terminarla se crea la próxima
  recurrenceSpawned?: boolean; // ya se creó la próxima (evita duplicados si la destildás y retildás)
  createdAt: string;
  subtasks?: SubTask[];
  // Modo Foco & Estimaciones
  subtareas?: SubtareaFoco[];
  estimadoMin?: number; // Tiempo estimado en minutos (ej: 25, 45, 60)
  pomodorosEstimados?: number; // Cantidad estimada de pomodoros (1-6)
  tiempoRealMin?: number; // Tiempo real acumulado trabajado
  projectId?: string;
  projectName?: string;
  reminderMinutesBefore?: number; // minutos de antelación para aviso (ej. 0 = exacto, 15, 30, 60, etc.)
  reminderNotified?: boolean; // si ya se disparó la notificación
  telegramReminded?: boolean; // si el servidor ya avisó por Telegram
  category?: DailyAllocationBucketId | 'general'; // Categoría / Bloque de jornada (video, edicion, foco, etc.)
  orderIndex?: number; // Posición personalizada dentro del día
  priority?: TaskPriority; // Prioridad opcional (alta, media, baja)
  kanbanStatus?: 'todo' | 'inprogress' | 'done'; // Estado manual en tablero Kanban
  notes?: string;
  missionId?: string; // Misión de la semana a la que pertenece esta tarea
}

export interface AgendaMeeting {
  proposed?: boolean; // Sin hora confirmada: no se envía a Google Calendar.
  id: string;
  title: string; // Título o Nombre del cliente
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM opcional
  notes?: string; // Campo de nota libre para resumen o pendientes
  completed: boolean;
  createdAt: string;
  clientPhone?: string;
  projectId?: string;
  projectName?: string;
  missionId?: string; // Misión opcional vinculada directamente
  reminderMinutesBefore?: number;
  reminderNotified?: boolean;
  telegramReminded?: boolean;
  googleEventId?: string; // Evento vinculado en Google Calendar
  googleSyncHash?: string; // Última versión sincronizada (evita ida y vuelta)
  durationHours?: number; // Duración de la sesión en horas (ej: 1 o 1.5) para sumar automáticamente a las horas de consultoría PAF
}

// 2. Proyectos (Estado simple)
export const DEFAULT_PROJECT_STATUSES = [
  'Posible proyecto',
  'Propuesta enviada',
  'En negociación',
  'En curso',
  'Esperando contenido',
  'En revisión',
  'Entregado',
  'Pausado',
  'No concretado',
] as const;

export type ProjectStatus = (typeof DEFAULT_PROJECT_STATUSES)[number] | string;

export type ProjectVisualStatus = 'not_started' | 'in_progress' | 'waiting_client' | 'overdue_payment' | 'completed';

export type ProjectType = 'paf_pro' | 'paf_base' | 'web' | 'otro';

export function getServiceType(projectType?: ProjectType | string): 'paf' | 'web' | 'otro' {
  if (projectType === 'paf_pro' || projectType === 'paf_base') return 'paf';
  if (projectType === 'web') return 'web';
  return 'otro';
}

export const PAF_STAGES = [
  'Kick-Off & Diagnóstico',
  'Mes 1: Infra & Web',
  'Mes 2: Ads & VSL',
  'Mes 3: Cierres',
  'Graduados',
] as const;

export type PafStage = (typeof PAF_STAGES)[number] | string;

export interface ProjectKeyLink {
  id: string;
  title: string;
  url: string;
  category?: 'drive' | 'figma' | 'meta' | 'vsl' | 'web' | 'maps' | 'instagram' | 'otro';
}

export interface PafMilestone {
  id: string;
  title: string;
  month: 1 | 2 | 3;
  week?: number;
  pillar: 'presencia' | 'adquisicion' | 'conversion' | 'general';
  description?: string;
  completed: boolean;
  completedAt?: string;
}

export interface PafConsultingSession {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  durationHours?: number; // Ej: 1 o 1.5
  hours?: number; // compatibilidad rápida
  topics?: string; // Temas tratados / foco
  topic?: string; // compatibilidad rápida
  notes?: string; // Minuta / acuerdos clave
  recordingUrl?: string; // Link de Drive / Meet / Loom
  completed?: boolean;
  createdAt?: string;
}

export type PaymentCommitmentStatus = 'pendiente' | 'parcial' | 'cobrado' | 'atrasado';

export interface FlexiblePaymentCommitment {
  id: string;
  title: string; // Concepto o hito (ej: "Anticipo 40%", "Entrega Web", "Cuota 1")
  dueDate: string; // YYYY-MM-DD
  amount: number; // Monto pactado
  amountPaid?: number; // Monto cobrado efectivamente
  currency?: 'USD' | 'ARS';
  status?: PaymentCommitmentStatus;
  paid?: boolean; // Compatibilidad
  paidAt?: string;
  notes?: string;
  incomeRecordId?: string;
  projectId?: string;
  clientName?: string;
}

export type RecurringFrequency = 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'dias';

export interface RecurringIncomePlan {
  id: string;
  title: string; // ej: "Abono Mantenimiento Web", "Retainer PAF"
  amount: number;
  currency: 'USD' | 'ARS';
  frequency: RecurringFrequency;
  intervalDays?: number; // si frequency === 'dias'
  startDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  active: boolean;
  projectId?: string;
  clientName?: string;
  notes?: string;
  amountHistory?: { date: string; amount: number; reason?: string }[]; // Registro de aumentos / inflación
  createdAt: string;
}

export type PaymentMethod = 'transferencia' | 'efectivo' | 'mercadopago' | 'usdt' | 'otro';

export interface Payment {
  id: string;
  projectId: string;
  amount: number; // Monto efectivamente pagado
  currency: 'USD' | 'ARS';
  date: string; // YYYY-MM-DD
  method: PaymentMethod;
  note?: string;
  destinationAccountId?: string; // ID de PersonalAccount en Mis Finanzas
  invoiced?: boolean; // Facturado / Comprobante emitido
  facturado?: boolean; // Facturado (alias)
  dolarRef?: number; // Referencia cotización dólar del día (ARS)
  incomeRecordId?: string; // Vínculo 1:1 con IncomeRecord para sincronización
  personalTransactionId?: string; // Vínculo 1:1 con PersonalTransaction
  createdAt: string;
}

export interface StudioPaymentSettings {
  id?: string;
  accountHolder?: string; // Titular
  aliasArs?: string; // Alias en pesos (ej. punto.cero.mp)
  cbuArs?: string; // CBU / CVU en pesos
  aliasUsd?: string; // Alias / cuenta en dólares
  cbuUsd?: string;
  paymentLink?: string; // Link de cobro (MercadoPago / Stripe / Lemon)
  usdtAddress?: string; // Billetera cripto USDT opcional
  mpAccessToken?: string; // Token de producción de Mercado Pago para webhook automático
  mpAutoPrompt?: boolean; // Preguntar automáticamente al detectar pago
  updatedAt?: string;
}

export interface MercadoPagoIncomingPayment {
  id: string;
  mpPaymentId: string;
  // recibido = te pagaron; enviado = pagaste vos (los viejos sin dato se toman como recibidos)
  direction?: 'recibido' | 'enviado';
  receivedAt?: string;
  dateTime?: string; // fecha y hora del pago (ISO)
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'refunded';
  amount: number;
  currency: 'ARS' | 'USD';
  payerName?: string;
  payerEmail?: string;
  payerIdentification?: string;
  description?: string;
  dateCreated: string;
  dateApproved?: string;
  reconciled: boolean;
  reconciledTo?: {
    type: 'cliente' | 'estudio_libre' | 'personal' | 'gasto_estudio' | 'gasto_personal' | 'ignorado';
    targetId?: string;
    targetName?: string;
    reconciledAt: string;
    destinationAccountId?: string;
  };
  rawPayload?: any;
  // Cliente probable que calculó el servidor (monto pendiente y/o nombre del pagador)
  suggestion?: { projectId: string; clientName: string; reason: string; score: number };
}

export interface ProjectInstallment {
  id: string;
  number: number;
  totalInstallments?: number;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  currency?: 'USD' | 'ARS';
  status?: 'pendiente' | 'cobrado' | 'atrasado';
  paid: boolean;
  paidAt?: string;
  note?: string;
  incomeRecordId?: string;
}

// -------------------------------------------------------------
// 2.1 Modelo de Acuerdo de Cobro Flexible (.Cero v3.8)
// -------------------------------------------------------------
export type BillingAgreementType = 
  | 'cuotas'       // Programa en cuotas (ej. PAF o custom N cuotas)
  | 'unico'        // Pago único
  | 'hitos'        // Hitos (ej. 50% anticipo / 25% intermedio / 25% entrega)
  | 'retainer'     // Abono mensual recurrente sin fin
  | 'por_hora';    // Por hora o trabajo suelto

export type CuotaStatus = 
  | 'pagado_a_tiempo' // Pagado a tiempo (verde)
  | 'pagado_tarde'    // Pagado con atraso (verde con marca de atraso)
  | 'pendiente'       // Pendiente (amarillo)
  | 'vence_hoy'       // Vence hoy (ámbar)
  | 'vencido'         // Vencido (rojo)
  | 'parcial'         // Parcial (azul)
  | 'futuro';         // Futuro / no iniciado (gris)

export interface BillingInstallment {
  id: string;
  number: number;
  totalInstallments?: number;
  title: string; // ej: "Mes 1", "Cuota 1", "Anticipo 50%", "Abono Octubre"
  dueDate: string; // YYYY-MM-DD
  expectedAmount: number; // Monto esperado
  currency: 'USD' | 'ARS';
  actualPaidAmount: number; // Monto efectivamente cobrado
  paidAt?: string; // Fecha real de pago (YYYY-MM-DD)
  paymentMethod?: PaymentMethod;
  destinationAccountId?: string;
  note?: string;
  status: CuotaStatus;
  delayDays?: number; // Días de atraso si pagó tarde o está vencido
  paymentId?: string; // Vínculo con Payment real
  incomeRecordId?: string;
}

export interface BillingAgreement {
  id: string;
  type: BillingAgreementType;
  title?: string;
  currency: 'USD' | 'ARS';
  totalAmount?: number;
  installmentsCount?: number;
  monthlyAmount?: number;
  hourlyRate?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  dueDayRule?: number; // Día del mes sugerido de vencimiento (ej. 10 o 15)
  preferredPaymentMethod?: PaymentMethod;
  notes?: string;
  installments: BillingInstallment[];
}

// Cliente: la persona o estudio. Puede tener varios proyectos (web, PAF, abonos...)
export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  rubro?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// Contacto registrado a mano en el historial del cliente
export interface ContactLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'whatsapp' | 'llamada' | 'email' | 'reunion' | 'nota';
  text?: string;
}

export interface Project {
  id: string;
  clientId?: string; // Cliente al que pertenece (se vincula solo por nombre)
  clientName: string; // Nombre del estudio / cliente (ej: "Estudio Cane Arquitectura")
  ownerName?: string; // Titular / Arq. responsable (ej: "Arq. Juan Cane")
  status: string; // Estado simple
  notes: string; // Un solo campo de nota libre, editable en cualquier momento
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastContactDate?: string; // Fecha del último contacto / mensaje registrado (YYYY-MM-DD)
  contactLog?: ContactLogEntry[]; // Historial de contactos (WhatsApp, llamadas, mails…)
  onboardingApplied?: boolean; // ya se usó (o se descartó) la plantilla de arranque
  clientPhone?: string; // WhatsApp comercial
  clientEmail?: string; // Mail del cliente (presupuestos y firma digital)
  webAutomationRequested?: boolean; // Cola de alta Web; el servidor la consume.
  instagramUrl?: string; // Perfil de Instagram institucional
  googleMapsUrl?: string; // Ficha de Google Business Profile (Maps)
  websiteUrl?: string; // Sitio web oficial o URL de staging / desarrollo
  isLead?: boolean; // True si es un posible proyecto / prospecto en negociación
  estimatedPrice?: number; // Valor de precio / presupuesto cotizado
  estimatedCurrency?: 'USD' | 'ARS'; // Moneda del valor estimado (default: ARS para PAF, USD o ARS)
  rubro?: string; // Rubro libre del cliente (ej. Arquitectura, Software, Marketing, Salud, etc.)
  // Finanzas Flexibles & Cobros Reales
  montoAcordado?: number; // Monto total acordado para el proyecto (referencia)
  billingAgreement?: BillingAgreement; // Acuerdo de cobro estructurado flexible
  payments?: Payment[]; // Pagos reales y efectivos registrados
  paymentCommitments?: FlexiblePaymentCommitment[]; // Compromisos / Recordatorios opcionales de pago
  recurringPlans?: RecurringIncomePlan[]; // Abonos / Retainers mensuales recurrentes vinculados
  // PAF & Advanced Project attributes
  serviceType?: 'paf' | 'web' | 'otro'; // Clasificación general de servicio
  projectType?: ProjectType; // Modalidad: 'paf_pro' (12 sem / 26h) | 'paf_base' | 'web'
  pafStage?: PafStage; // Etapa actual del Método PAF (Kick-Off, Mes 1, Mes 2, Mes 3, Graduados)
  pafPlan?: '1_pago' | '2_pagos' | '3_pagos' | string; // Esquema de pago acordado
  pafConsultingHoursTotal?: number; // Total horas de consultoría acordadas (ej: 26hs para PAF Pro)
  pafConsultingHoursDone?: number; // Horas realizadas de las 26hs de consultoría 1:1
  consultingSessions?: PafConsultingSession[]; // Bitácora de sesiones 1:1
  pafMilestones?: PafMilestone[]; // Checklist de hitos PAF de 12 semanas / 3 meses
  deliveryDate?: string; // Fecha de entrega final o fin de los 3 meses (YYYY-MM-DD)
  startDate?: string; // Fecha de inicio de aceleración (YYYY-MM-DD)
  leadScore?: 'A' | 'B' | 'C'; // Calificación de prospecto arquitecto (A: Calificado inmediato, B: Potencial, C: Curioso)
  keyLinks?: ProjectKeyLink[]; // Centro de enlaces clave (Drive, Figma, Ads, VSL, Maps, etc.)
  pafStartDate?: string; // Fecha de inicio de la mentoría (YYYY-MM-DD)
  pafInstallmentDates?: { number: number; dueDate: string; amount: number; paid: boolean; paidAt?: string; note?: string }[]; // Compatibilidad
  installments?: ProjectInstallment[]; // Plan de cuotas exactas
  pafStageChecklist?: Record<string, { id: string; text: string; done: boolean }[]>; // Hitos de salida por etapa
  studentPortalToken?: string; // Link de solo lectura para el alumno (/alumno/{token})
  statusOverride?: 'not_started' | 'in_progress' | 'waiting_client' | 'overdue_payment' | 'completed'; // Override manual del sistema de estado visual
  // Horizonte (Línea de tiempo & Capacidad de largo plazo)
  horizonStart?: string; // YYYY-MM-DD override para el Horizonte
  horizonEnd?: string; // YYYY-MM-DD override para el Horizonte
  frente?: string; // Override manual del frente ('PAF' | 'Webs' | 'Otros')
  cupos?: number; // Cupos de dedicación simultánea (default 1)
}

// Time Tracking / Registro de Dedicación (#6)
export interface TimeLog {
  id: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  description: string;
  durationMinutes?: number; // en minutos
  minutes?: number; // compatibilidad
  date: string; // YYYY-MM-DD
  createdAt: string;
  billable?: boolean;
}

// 3. Ingresos Libres y Movimientos Financieros
export const DEFAULT_INCOME_CATEGORIES = [
  'Desarrollo Web & Landing Pages',
  'Pauta Publicitaria & Ads (Meta / Google)',
  'Mantenimiento & Retainer Mensual',
  'Diseño UI/UX & Identidad',
  'Consultoría & Setup Digital',
  'Trabajos Sueltos / Varios',
] as const;

export type IncomeCategory = (typeof DEFAULT_INCOME_CATEGORIES)[number] | string;

export interface IncomeRecord {
  id: string;
  title: string; // Proyecto o concepto libre
  concept?: string; // Alias de concepto
  category?: IncomeCategory; // Categoría de ingreso
  month: string; // YYYY-MM, ej: "2026-09"
  date: string; // YYYY-MM-DD
  amount: number;
  currency: 'USD' | 'ARS';
  status: 'cobrado' | 'pendiente';
  createdAt: string;
  projectId?: string; // Opcional: puede ser un cobro libre sin proyecto
  projectName?: string;
  notes?: string;
  commitmentId?: string; // Vínculo opcional con un compromiso de pago
  paymentId?: string; // Vínculo con el pago real (Payment)
  facturado?: boolean; // Facturado / Pendiente de facturar
  source?: string;
}

// 4. Gastos / Egresos Directos y Operativos
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Pauta & Inversión Ads (Meta, Google)',
  'Servidores, Hosting & Dominios',
  'Software, SaaS & IA (Figma, GitHub, OpenAI)',
  'Subcontratos & Freelancers (Copy, Video, Renders)',
  'Impuestos & Servicios',
  'Equipamiento & Hardware',
  'General de Estudio',
  'Otros',
] as const;

export type ExpenseCategory = (typeof DEFAULT_EXPENSE_CATEGORIES)[number] | string;

export interface ExpenseRecord {
  id: string;
  title: string; // Concepto del gasto
  category: ExpenseCategory;
  month: string; // YYYY-MM, ej: "2026-09"
  date: string; // YYYY-MM-DD
  amount: number;
  currency: 'USD' | 'ARS';
  status: 'pagado' | 'pendiente';
  createdAt: string;
  projectId?: string; // Opcional: vinculado a un proyecto o general
  projectName?: string;
  notes?: string;
  fixedExpenseId?: string; // Si viene de pagar un gasto fijo (evita contarlo dos veces en el neto)
}

// 4.1 Gastos Fijos del Estudio, Suscripciones & Vencimientos (Hosting, Dominios, IAs, Software)
export const DEFAULT_FIXED_EXPENSE_CATEGORIES = [
  'ia',
  'hosting',
  'dominios',
  'software',
  'servicios',
  'otro'
] as const;

export type StudioFixedExpenseCategory = (typeof DEFAULT_FIXED_EXPENSE_CATEGORIES)[number];

export type StudioBillingCycle = 'mensual' | 'anual' | 'trimestral' | 'semestral' | 'bianual';

export interface StudioFixedExpense {
  id: string;
  name: string; // ej: "Hostinger Business Web Hosting", "Dominio puntocero.com.ar", "Claude Pro", "Cursor AI"
  provider?: string; // ej: "Hostinger", "Nic.ar", "OpenAI", "Anthropic", "Namecheap", "Vercel", "Donweb"
  category: StudioFixedExpenseCategory;
  amount: number;
  currency: 'USD' | 'ARS';
  billingCycle: StudioBillingCycle; // 'mensual' | 'anual' | 'trimestral' | 'semestral' | 'bianual'
  nextDueDate: string; // YYYY-MM-DD: fecha de próximo vencimiento / renovación
  lastPaidDate?: string; // YYYY-MM-DD: fecha del último pago realizado
  autoRenew?: boolean; // si se cobra automáticamente o es manual
  projectId?: string; // Opcional: vinculado a un cliente/proyecto (ej: dominio de cliente pasado)
  clientName?: string; // Nombre del cliente vinculado
  notes?: string; // Notas de DNS, plan, acceso, etc.
  active: boolean; // activo / pausado
  paymentMethod?: string; // ej: "Tarjeta Visa", "Mercado Pago"
  createdAt: string;
}

// 5. Objetivos Semanales y Metas Cuantitativas (Goals con Progreso)
export type GoalTargetType = 'boolean' | 'numeric' | 'currency' | 'tasks';
export type GoalStatus = 'al_dia' | 'adelantada' | 'retrasada' | 'sin_plazo';

export interface GoalSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  weekStart: string; // YYYY-MM-DD (Lunes de la semana)
  completed: boolean;
  createdAt: string;
  category?: 'ventas' | 'produccion' | 'organizacion' | 'general';
  notes?: string;
  targetType?: GoalTargetType;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  subtasks?: GoalSubtask[];
  status?: GoalStatus;
  deadline?: string;
}

// 5.1 Misiones de la Semana (Evolución de WeeklyGoal)
export type MissionFrente = 'PAF' | 'Webs' | 'Contenido' | 'Comercial' | 'Otros';
export type MissionTipo = 'mision' | 'mantenimiento' | 'cobro';
export type MissionEstado = 'activa' | 'terminada' | 'arrastrada' | 'descartada';
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export interface MissionPaso {
  id: string;
  titulo: string;
  hecho: boolean;
}

export interface WeeklyMission extends WeeklyGoal {
  resultadoEsperado?: string; // una frase que define cuándo está terminada
  frente?: MissionFrente; // obligatorio en misiones nuevas
  projectId?: string; // cliente vinculado opcional
  tipo?: MissionTipo; // 'mision' | 'mantenimiento' | 'cobro'
  presupuestoHoras?: number;
  pasos?: MissionPaso[]; // lista de 3 a 5 pasos grandes {id, titulo, hecho}
  diasPlanificados?: DiaSemana[]; // lista de días de la semana en que se trabaja
  estado?: MissionEstado; // 'activa' | 'terminada' | 'arrastrada' | 'descartada'
  orden?: number;

  // Metadatos de cobro automático, arrastre y cierre
  descarteMotivo?: string;
  arrastradaFromWeek?: string;
  isAutoCobro?: boolean;
  cobroInstallmentId?: string;
  cobroAmount?: number;
  cobroCurrency?: 'ARS' | 'USD';
}

export interface WeeklyReviewHistoryItem {
  id: string;
  weekStart: string; // YYYY-MM-DD
  closedAt: string;
  balance: {
    total: number;
    terminadas: number;
    aMedias: number;
    descartadas: number;
    arrastradas: number;
    horasPresupuestadas: number;
    horasReales: number;
  };
  aprendizaje: string; // "Qué funcionó / Qué trabó la semana"
}

export interface MissionsConfig {
  maxGrandes: number; // por defecto 3
  maxMantenimiento: number; // por defecto 1
  diaCierre: 'viernes' | 'domingo'; // por defecto 'domingo'
}

// 5.1 Segundo Cerebro & Notas Conectadas (Second Brain)
export interface SecondBrainNote {
  id: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  tags?: string[];
  folder?: string; // Carpeta opcional (ej: Personal, PAF, Ideas, etc.)
  pinned?: boolean;
  linkedEntityTitles?: string[]; // [[Metas]], [[Proyectos]], [[Notas]]
  createdAt: string;
  updatedAt: string;
}

export type Note = SecondBrainNote;


// 6. Distribución de Jornada (Time Budget Flexible & Timeboxing Elástico)
export type DailyAllocationBucketId = 
  | 'grabacion' 
  | 'edicion' 
  | 'guion' 
  | 'foco' 
  | 'gestion' 
  | 'estrategia' 
  | 'buffer';

export type DailyAllocationMode = 'libre' | 'cronograma';

export interface ActiveTimeboxSession {
  bucketId: DailyAllocationBucketId;
  label: string;
  initialMinutes: number; // Ej. 45 o 60 min de partida
  extendedMinutes: number; // Ej. 15 o 30 min extendidos
  targetEndTimestamp: number; // Date.now() + (initial + extended) * 60 * 1000
  isRunning: boolean;
  isAlarmDismissed?: boolean;
  startedAt: string; // ISO
}

export interface DailyBucketAllocation {
  id: DailyAllocationBucketId;
  label: string;
  iconName: 'video' | 'scissors' | 'file-text' | 'laptop' | 'message' | 'target' | 'coffee';
  description: string;
  allocatedMinutes: number; // Ej. 60 = 1h
  completedMinutes?: number; // Lo cumplido real acumulado
  completed: boolean; // Checkbox o cumplimiento de la intención
  note?: string; // Nota breve (ej: "Tomas de YouTube hook + intro")
}

export interface DailyAllocation {
  id: string; // Document ID: 'YYYY-MM-DD'
  date: string; // 'YYYY-MM-DD'
  targetHours: number; // Capacidad definida para el día (ej: 0, 4, 6, 8)
  buckets: Partial<Record<DailyAllocationBucketId, DailyBucketAllocation>>;
  activeSession?: ActiveTimeboxSession | null;
  activePreset?: 'creador' | 'estudio' | 'todos';
  isPaused?: boolean; // Si el usuario eligió "No planificar hoy / Pausar por hoy"
  mode?: DailyAllocationMode; // 'libre' (bolsas acumulativas) | 'cronograma' (secuencia sugerida)
  startTime?: string; // Hora de inicio sugerida ej: "09:30" para calcular franjas
  updatedAt?: string;
  notes?: string;
}

// 7. Sync & Auth Status
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface AppDataPayload {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  weeklyGoals?: WeeklyGoal[];
  timeLogs?: TimeLog[];
  dailyAllocations?: DailyAllocation[];
  theme: 'dark' | 'light';
  updatedAt?: string | null;
  isReset?: boolean;
  deviceId?: string;
}

// 8. Gemini Multi-Turn Chatbot & Agentic Execution
export type GeminiModelId = 'gemini-2.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.7-flash' | 'gemini-3.8-flash' | 'gemini-3.1-pro-preview';
export type GeminiRolePreset = 'operativo' | 'paf' | 'proyectos' | 'finanzas';

export interface ChatActionExecution {
  id: string;
  name: string;
  args: Record<string, any>;
  description: string;
  status: 'executed' | 'failed';
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  actionsExecuted?: ChatActionExecution[];
}

// -------------------------------------------------------------
// 9. MÓDULO DE FINANZAS PERSONALES (.Cero Personal Finance)
// -------------------------------------------------------------

export type PersonalAccountType = 'efectivo' | 'banco' | 'billetera_virtual' | 'dolares' | 'otro';

export interface PersonalAccount {
  id: string;
  name: string; // ej: Efectivo, Mercado Pago, Banco Galicia, Dólares en mano
  currency: 'ARS' | 'USD';
  initialBalance: number;
  color: string;
  icon: string;
  archived: boolean;
  createdAt?: string;
}

export type PersonalCategoryType = 'ingreso' | 'gasto' | 'ahorro' | 'estudio';

export interface PersonalCategory {
  id: string;
  name: string;
  type: PersonalCategoryType;
  color: string;
  icon: string;
  parentId?: string;
  monthlyBudget?: number;
  createdAt?: string;
}

export type PersonalTransactionType = 'ingreso' | 'gasto' | 'transferencia' | 'ahorro';
export type PersonalTransactionStatus = 'confirmado' | 'pendiente';

export interface PersonalTransaction {
  id: string;
  type: PersonalTransactionType;
  amount: number;
  currency: 'ARS' | 'USD';
  date: string; // YYYY-MM-DD
  time?: string;
  accountId: string;
  toAccountId?: string; // Para transferencias
  categoryId: string;
  note?: string;
  tags?: string[];
  recurringId?: string;
  exchangeRate?: number; // Cotización usada si se convierte USD <-> ARS
  status: PersonalTransactionStatus;
  createdAt: string;

  // Vínculos opcionales con el ecosistema de la app
  projectId?: string;
  projectName?: string;
  sourceIncomeId?: string; // Si el ingreso proviene de un cobro de cliente
  taskId?: string;
  noteId?: string;
  studyItemId?: string;
  linkedWithdrawalStudioIncomeId?: string; // Vínculo con retiro de dueño en estudio
  deletedAt?: string; // Papelera de reciclaje
}

export type PersonalRecurringFrequency = 'semanal' | 'quincenal' | 'mensual' | 'anual' | 'custom';

export interface PersonalRecurring {
  id: string;
  title: string;
  type: PersonalTransactionType;
  amount: number;
  currency: 'ARS' | 'USD';
  accountId: string;
  categoryId: string;
  frequency: PersonalRecurringFrequency;
  nextDate: string; // YYYY-MM-DD
  active: boolean;
  note?: string;
  createdAt?: string;
}

export interface PersonalBudget {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  limit: number;
  currency: 'ARS' | 'USD';
  createdAt?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currency: 'ARS' | 'USD';
  savedAmount: number;
  deadline?: string; // YYYY-MM-DD
  linkedAccountId?: string;
  color?: string;
  icon?: string;
  notes?: string;
  createdAt?: string;
}

export type StudyItemKind = 'curso' | 'libro' | 'herramienta' | 'suscripcion' | 'certificacion' | 'otro';
export type StudyItemStatus = 'planeado' | 'en curso' | 'terminado';

export interface StudyItem {
  id: string;
  title: string; // Curso, libro, herramienta, suscripción, certificación
  kind: StudyItemKind;
  totalCost: number;
  currency: 'ARS' | 'USD';
  status: StudyItemStatus;
  hoursInvested: number; // Horas dedicadas (se alimenta o sincroniza con TimeLog)
  noteId?: string;
  projectId?: string; // Para qué cliente o servicio me sirve
  projectName?: string;
  link?: string;
  notes?: string;
  createdAt?: string;
}

export interface PersonalFinanceSettings {
  id?: string;
  usdExchangeRate: number; // Cotización manual editable para conversiones
  usdRateSource?: 'blue' | 'mep' | 'oficial' | 'manual'; // De dónde sale la cotización (por defecto: blue automático)
  customPin?: string; // PIN opcional para este módulo
  pinEnabled?: boolean;
  scriptableToken?: string; // Token de lectura para el widget de Scriptable en iPhone
  hideAmountsInWidget?: boolean;
  updatedAt?: string;
}

// -------------------------------------------------------------
// 10. PAPELERA DE RECICLAJE (TRASH)
// -------------------------------------------------------------
export type TrashItemType = 
  | 'cliente' 
  | 'ingreso' 
  | 'gasto' 
  | 'tarea' 
  | 'reunion' 
  | 'nota' 
  | 'pago' 
  | 'movimiento_personal';

export interface TrashItem {
  id: string;
  itemType: TrashItemType;
  title: string;
  subtitle?: string;
  amount?: number;
  currency?: 'USD' | 'ARS';
  data: any; // Registro original completo para restaurar sin pérdida
  deletedAt: string; // ISO string
  expiresAt: string; // ISO string (30 días desde deletedAt)
}

// -------------------------------------------------------------
// 11. GASTOS FIJOS / RECURRENTES DEL ESTUDIO
// -------------------------------------------------------------
export interface StudioRecurringExpense {
  id: string;
  title: string; // ej: Vercel, Supabase, OpenAI, Figma
  amount: number;
  currency: 'USD' | 'ARS';
  frequency: 'mensual' | 'anual';
  renewalDay: number; // 1-31
  category: ExpenseCategory;
  projectId?: string; // Opcional si es atribuible a un cliente
  projectName?: string;
  notes?: string;
  active: boolean;
  lastPaidMonth?: string; // YYYY-MM
  createdAt: string;
  deletedAt?: string;
}

// -------------------------------------------------------------
// 12. AJUSTES AMPLIADOS (.CERO APP SETTINGS)
// -------------------------------------------------------------

// 12.1 Perfil del Estudio
export interface StudioProfileSettings {
  id?: string;
  studioName?: string; // Nombre del estudio / agencia (ej: "Punto Cero")
  ownerName?: string; // Nombre del titular / consultor
  logoUrl?: string;
  phone?: string; // WhatsApp / Teléfono de contacto
  email?: string;
  cuit?: string; // CUIT / Identificación fiscal
  signature?: string; // Firma para recibos y notas
  address?: string; // Ciudad / País
  updatedAt?: string;
}

// 12.2 Objetivos Económicos & Parámetros Financieros
export interface StudioEconomicGoals {
  targetHourlyRateArs?: number; // Tarifa objetivo por hora en ARS (ej: $25.000)
  targetHourlyRateUsd?: number; // Tarifa objetivo por hora en USD (ej: $35)
  monthlyTargetSalaryArs?: number; // Sueldo objetivo mensual del dueño (ARS)
  monthlyTargetSalaryUsd?: number;
  monotributoCategory?: string; // Categoría de monotributo (ej: "Cat. H")
  monotributoCapArs?: number; // Tope anual facturación monotributo ARS (ej: $68.000.000)
  // Reparto Sugerido de Cobros (Informativo)
  suggestedSplitEnabled?: boolean;
  suggestedSplitTaxes?: number; // % Impuestos (ej: 15)
  suggestedSplitSavings?: number; // % Ahorro / Fondo (ej: 20)
  suggestedSplitReinvestment?: number; // % Reinversión / Herramientas (ej: 15)
  suggestedSplitSalary?: number; // % Sueldo / Retiro dueño (ej: 50)
  // Umbrales de Inactividad & Alertas
  clientInactivityDaysThreshold?: number; // Días sin contacto para alerta (default 14)
  leadInactivityDaysThreshold?: number; // Días sin seguimiento para alerta de lead (default 7)
}

// 12.3 Plantillas de Mensajes WhatsApp
export interface WhatsAppTemplatesSettings {
  cobroAmable: string;
  cobroFirme: string;
  cobroUltimoAviso: string;
  leadFollowup: string;
  postMeeting: string;
  projectHandover: string;
}

// 12.4 Catálogo de Servicios
export interface ServiceCatalogItem {
  id: string;
  name: string; // ej: "Desarrollo Web & Landing", "Programa PAF Pro (12 Semanas)"
  type: 'paf' | 'web' | 'otro';
  suggestedPrice: number;
  currency: 'USD' | 'ARS';
  deliverablesTemplate?: string[]; // Checklist de entregables iniciales
  active: boolean;
  notes?: string;
}

// 12.5 Categorías Personalizadas
export interface CustomCategoriesSettings {
  incomeCategories: { name: string; hidden?: boolean }[];
  expenseCategories: { name: string; hidden?: boolean }[];
  personalExpenseCategories?: { name: string; hidden?: boolean }[];
}

// 12.6 Valores por Defecto
export interface AppDefaultsSettings {
  defaultCurrency?: 'ARS' | 'USD';
  defaultPaymentMethod?: PaymentMethod;
  defaultMeetingDurationMinutes?: number; // ej: 60
  workHoursStart?: string; // ej: "09:00"
  workHoursEnd?: string; // ej: "18:00"
  defaultStartSector?: '/hoy' | '/clientes' | '/dinero' | '/cerebro' | '/ajustes';
}

// 12.7 Avisos Dentro de la App
export interface InAppAlertSettings {
  alertOverduePayments: boolean;
  alertOverdueNextSteps: boolean;
  alertUpcomingMeetings: boolean;
  alertUpcomingStudioExpenses: boolean;
  alertMonotributoThreshold: boolean;
  advanceNoticeMinutes: number; // 15, 30, 60
  silentHoursEnabled: boolean;
  silentHoursStart: string; // ej: "22:00"
  silentHoursEnd: string; // ej: "08:00"
}

// 12.8 Cierre Mensual Guardado (Histórico)
export interface MonthlyClosingRecord {
  id: string;
  month: string; // YYYY-MM
  totalCobradoArs: number;
  totalCobradoUsd: number;
  totalGastosArs: number;
  totalGastosUsd: number;
  totalRetirosArs: number;
  totalRetirosUsd: number;
  netoArs: number;
  netoUsd: number;
  gananciaRetenidaArs: number;
  gananciaRetenidaUsd: number;
  dolarRef: number;
  byClient?: { clientName: string; amount: number; currency: 'ARS' | 'USD'; serviceType?: string }[];
  byService?: { serviceType: string; amountArs: number; amountUsd: number }[];
  notes?: string;
  closedAt: string;
}




// ================== PROSPECCIÓN EN FRÍO ==================
export type ProspectStage =
  | 'nuevo' // cargado, todavía sin primer mensaje
  | 'contactado' // conversación iniciada, esperando respuesta (con seguimientos)
  | 'respondio' // contestó: hay que responderle
  | 'auditoria_enviada' // se le pasó el link de la auto auditoría
  | 'auditoria_completada' // completó el quiz: toca mandar el video (24-48 hs)
  | 'video_enviado'
  | 'llamada' // llamada agendada o hecha
  | 'cliente'
  | 'descartado';

export interface ProspectAudit {
  completedAt: string; // ISO
  total: number; // 0-30
  presencia: number; // 0-10
  adquisicion: number; // 0-10
  funnel: number; // 0-10
  nivel: string; // Inicial | Intermedio | Avanzado
  dedicacion?: string;
  tamanioEquipo?: string;
  dolorCaptacion?: string;
  origenClientes?: string;
  inversionPrevia?: string;
  proyectosActivos?: string;
  ciudad?: string;
  observaciones?: string;
  respuestas?: Record<string, string>; // q1..q15 -> texto elegido
}

export interface Prospect {
  id: string;
  name: string; // persona
  studio?: string; // estudio / empresa
  instagram?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  source?: string; // de dónde salió (Instagram, Google Maps, referido...)
  notes?: string;
  stage: ProspectStage;
  createdAt: string; // YYYY-MM-DD
  plannedFirstContact?: string; // día asignado para el primer mensaje
  nextActionDate?: string; // cuándo vuelve a aparecer en la cola
  followUps: number; // seguimientos enviados desde el último contacto sin respuesta
  lastContactAt?: string; // YYYY-MM-DD del último mensaje enviado
  lastOutcomeAt?: string; // YYYY-MM-DD del último cierre del día registrado
  videoDueDate?: string; // vencimiento del video tras la auditoría
  audit?: ProspectAudit;
  lostReason?: string;
  convertedProjectId?: string;
  updatedAt?: string;
  // Desde la reserva (base del scraper)
  poolId?: string;
  score?: number;
  segment?: string; // arquitectura | paisajismo | interiorismo | construccion
  country?: string; // ISO
  website?: string;
  // Guion de conversación (cuando respondió)
  convStep?: ConvStep;
  difusion?: DifusionKey; // cómo difunde su trabajo hoy (su respuesta a la pregunta)
  // Mejoras de prospección
  pulledOn?: string; // día en que lo sumaste a mano ("sumar más hoy"): entra a la lista aunque pase el tope
  variant?: 'A' | 'B'; // qué versión del primer mensaje recibió
  personalLine?: string; // frase personalizada (IA) para el primer mensaje
  videoUrl?: string; // link del video de la auditoría
  callDate?: string; // día de la llamada agendada
  callTime?: string; // hora de la llamada (HH:MM, hora de Argentina)
  calendlyEventUri?: string; // si la agendó por Calendly
  proposalSentAt?: string; // propuesta enviada después de la llamada
  secondChance?: boolean; // volvió de descartados a los 90 días
  recycleAfter?: string; // desde cuándo puede volver a la lista (descartado sin respuesta)
  doNotContact?: boolean; // pidió que no lo contacten más
  // A quién le toca escribir
  awaitingMe?: boolean; // te escribió y te toca contestar (en cualquier etapa)
  lastReplyAt?: string; // última vez que te escribió (YYYY-MM-DD)
  lastReplyNote?: string; // qué te dijo (opcional)
  firstVariant?: number; // qué versión del primer mensaje recibió
  // Historial de la conversación (lo que te dijo y lo que le mandaste)
  log?: ProspectLogEntry[];
  dealValue?: number; // cuánto vale la oportunidad (tablero de oportunidades)
  dealCurrency?: 'ARS' | 'USD';
}

// Pasos del guion: pregunta → (su respuesta) → empatía → (acuerdo) → speech + link de auditoría
export interface ProspectLogEntry {
  action?: string;
  at: string; // ISO
  dir: 'in' | 'out' | 'nota'; // te escribió / le escribiste / nota tuya
  text: string;
}

export type ConvStep = 'pregunta' | 'esperando_respuesta' | 'empatia' | 'esperando_acuerdo' | 'speech';

export type DifusionKey = 'portales' | 'referidos' | 'anuncios' | 'redes' | 'contenido_ig' | 'agencia' | 'otro';

export type ProspectEventType =
  | 'conversation_sent'
  | 'conversation_reply'
  | 'deferred'
  | 'call_rescheduled'
  | 'note'
  | 'proposal_sent'
  | 'first_contact'
  | 'follow_up'
  | 'reply'
  | 'no_reply'
  | 'audit_sent'
  | 'audit_completed'
  | 'video_sent'
  | 'call'
  | 'won'
  | 'lost';

export interface ProspectEvent {
  prospectName?: string;
  action?: string;
  id: string;
  prospectId: string;
  type: ProspectEventType;
  date: string; // YYYY-MM-DD
  note?: string;
  variant?: 'A' | 'B'; // en el primer mensaje: qué versión se mandó
  firstVariant?: number; // en el primer mensaje: cuál de las variantes
  createdAt: string; // ISO
}

export interface ProspectingSettings {
  followUpDays: number; // días entre seguimientos
  maxFollowUps: number; // después de esto propone descartar
  dailyCap: number; // acciones máximas en la cola del día
  firstContactsPerDay: number; // reparto de la tanda semanal
  closeHour: number; // desde qué hora pide el cierre del día
  weeklyBatchSize: number; // contactos que pasan de la reserva a la semana (0 = no automático)
  poolCountries: string[]; // vacío = todos
  poolSegments: string[]; // vacío = todos
  lastBatchWeek?: string; // lunes de la última tanda automática
  workDays: number[]; // días en que prospectás (0 domingo ... 6 sábado); la tanda se reparte en estos
  weeklyGoal: number; // meta de conversaciones nuevas por semana
  bookingUrl: string; // tu link para agendar llamada (Google Calendar / Cal.com)
  dayStartedOn?: string; // último día en que hiciste el "inicio del día"
  templates: {
    first: string;
    firstVariants: string[]; // variantes del primer mensaje (se reparten para no sonar a spam)
    followUp: string[]; // seguimiento 1, 2, 3
    followUpQuestion: string; // no contestó la pregunta
    followUpAgree: string; // no contestó después de la empatía
    followUpAudit: string; // le pasaste el link y no completó la auditoría
    question: string; // "¿Cómo haces para difundir tu trabajo...?"
    empathy: Record<DifusionKey, string>; // respuesta según cómo difunde
    speech: string; // caballo de Troya + link de auditoría
    firstB: string; // segunda versión del primer mensaje (vacío = sin prueba A/B)
    secondChance: string; // primer mensaje para quien vuelve a los 90 días
    booking: string; // después del video: invitar a agendar la llamada
    proposal: string; // seguimiento de la propuesta después de la llamada
    audit: string; // (compatibilidad: igual a speech)
    video: string;
  };
}
