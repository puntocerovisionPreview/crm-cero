import type { BillingInstallment, FlexiblePaymentCommitment, PafMilestone, Project, ProjectInstallment, RecurringIncomePlan } from '../types';
import { PAF_BASE_MILESTONES, PAF_PRO_MILESTONES } from './pafTemplates';
import { kitDelTema, temaPorId, type Servicio } from '../portal/presencia';

/** Anuncio de bienvenida que se deja listo (sin publicar) en cada PAF nuevo */
export const BIENVENIDA_PAF = {
  titulo: 'Bienvenida',
  texto: '¡Bienvenido a tu portal! Acá vas a ver en qué estamos, lo que necesitamos de vos y todo lo que te entregamos. Para arrancar, completá las tareas de abajo.',
};

/** Día hábil N días después (para proponer la reunión de arranque) */
export function businessDaysAfter(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d.toLocaleDateString('en-CA');
}

/**
 * ALTA EN UNA PANTALLA: arma la ficha a partir de lo que carga Juan.
 * Precio libre: monto y moneda, con pago único, cuotas o mensual (con o sin fin).
 * Lógica pura: la usan la pantalla "Nuevo cliente" y los tests.
 */

export type BillingMode = 'unico' | 'cuotas' | 'mensual';

export interface NewClientForm {
  tipo: 'paf' | 'web';
  plan: 'paf_pro' | 'paf_base';
  estudio: string;
  contacto: string;
  email: string;
  whatsapp: string;
  monto: number;
  moneda: 'USD' | 'ARS';
  modo: BillingMode;
  /** Pago único o primera cuota / primer mes (YYYY-MM-DD) */
  primerCobro: string;
  cuotas: number;
  /** Mensual: cantidad de meses (vacío = sin fin) */
  meses?: number;
  nota: string;
  /** PAF: lo que contrató además de la base (contenido, Google, web) */
  alcance?: Servicio[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewClient(f: NewClientForm): string[] {
  const errors: string[] = [];
  if (!f.estudio.trim()) errors.push('Falta el nombre del estudio.');
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) errors.push('El correo no es válido.');
  if (f.tipo === 'paf' && !f.email.trim()) errors.push('Para PAF hace falta el correo: con ese se comparte la carpeta y entra al portal.');
  if (!(f.monto >= 0)) errors.push('El monto tiene que ser un número.');
  if (f.monto > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(f.primerCobro)) errors.push('Falta la fecha del primer cobro.');
  if (f.modo === 'cuotas' && (!Number.isInteger(f.cuotas) || f.cuotas < 2 || f.cuotas > 24)) errors.push('Las cuotas tienen que ser entre 2 y 24.');
  if (f.modo === 'mensual' && f.meses !== undefined && (!Number.isInteger(f.meses) || f.meses < 1 || f.meses > 60)) errors.push('La duración tiene que ser entre 1 y 60 meses (o vacía, sin fin).');
  return errors;
}

/** Misma fecha N meses después (si el mes es más corto, el último día) */
export function addMonthsKeepDay(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Reparte el monto en N cuotas; la última absorbe el redondeo para que sume justo */
export function splitAmount(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const list = Array.from({ length: n }, () => base);
  list[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100;
  return list;
}

export function buildNewClientProject(f: NewClientForm, now = new Date()): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> {
  const stamp = now.getTime();
  const today = now.toLocaleDateString('en-CA');
  const isPaf = f.tipo === 'paf';
  const currency = f.moneda;

  // Cuotas a cobrar (para Cobros, la proyección y el próximo cobro)
  let schedule: { title: string; dueDate: string; amount: number }[] = [];
  if (f.monto > 0) {
    if (f.modo === 'unico') schedule = [{ title: 'Pago único', dueDate: f.primerCobro, amount: f.monto }];
    if (f.modo === 'cuotas') schedule = splitAmount(f.monto, f.cuotas).map((amount, i) => ({ title: `Cuota ${i + 1}`, dueDate: addMonthsKeepDay(f.primerCobro, i), amount }));
    if (f.modo === 'mensual' && f.meses) schedule = Array.from({ length: f.meses }, (_, i) => ({ title: `Mes ${i + 1}`, dueDate: addMonthsKeepDay(f.primerCobro, i), amount: f.monto }));
  }

  const installments: ProjectInstallment[] = schedule.map((s, i) => ({
    id: `cmt_${stamp}_${i + 1}`, number: i + 1, totalInstallments: schedule.length, amount: s.amount, currency, dueDate: s.dueDate, paid: false, note: s.title,
  }));
  const paymentCommitments: FlexiblePaymentCommitment[] = schedule.map((s, i) => ({
    id: `cmt_${stamp}_${i + 1}`, title: s.title, amount: s.amount, dueDate: s.dueDate, currency, status: 'pendiente', clientName: f.estudio.trim(),
  } as FlexiblePaymentCommitment));
  const agreementInstallments: BillingInstallment[] = schedule.map((s, i) => ({
    id: `cmt_${stamp}_${i + 1}`, number: i + 1, totalInstallments: schedule.length, title: s.title, dueDate: s.dueDate,
    expectedAmount: s.amount, currency, actualPaidAmount: 0, status: 'pendiente',
  }));

  // Mensual sin fin: abono recurrente (lo toma la proyección mes a mes)
  const recurringPlans: RecurringIncomePlan[] | undefined = f.monto > 0 && f.modo === 'mensual' && !f.meses
    ? [{ id: `rec_${stamp}`, title: `Abono mensual · ${f.estudio.trim()}`, amount: f.monto, currency, frequency: 'mensual', startDate: f.primerCobro, nextDueDate: f.primerCobro, active: true, clientName: f.estudio.trim(), createdAt: today }]
    : undefined;

  const total = f.modo === 'mensual' ? (f.meses ? f.monto * f.meses : 0) : f.monto;
  const milestones: PafMilestone[] | undefined = isPaf
    ? (f.plan === 'paf_pro' ? PAF_PRO_MILESTONES : PAF_BASE_MILESTONES).map((m, i) => ({ ...m, id: `m_${stamp}_${i}`, completed: false }))
    : undefined;

  return {
    clientName: f.estudio.trim(),
    ownerName: f.contacto.trim() || undefined,
    status: isPaf ? 'Kick-Off & Diagnóstico' : 'No iniciado',
    notes: f.nota.trim(),
    archived: false,
    clientPhone: f.whatsapp.trim() || undefined,
    clientEmail: f.email.trim().toLowerCase() || undefined,
    montoAcordado: total || undefined,
    estimatedPrice: total || undefined,
    estimatedCurrency: currency,
    billingAgreement: f.monto > 0 ? {
      id: `agr_${stamp}`,
      type: f.modo === 'mensual' ? 'retainer' : f.modo,
      title: f.estudio.trim(),
      currency,
      totalAmount: total || undefined,
      monthlyAmount: f.modo === 'mensual' ? f.monto : undefined,
      installmentsCount: schedule.length,
      startDate: f.primerCobro,
      endDate: schedule.length ? schedule[schedule.length - 1].dueDate : undefined,
      dueDayRule: Number(f.primerCobro.slice(8, 10)) || 10,
      installments: agreementInstallments,
    } : undefined,
    paymentCommitments: paymentCommitments.length ? paymentCommitments : undefined,
    installments: installments.length ? installments : undefined,
    recurringPlans,
    serviceType: f.tipo,
    projectType: isPaf ? f.plan : 'web',
    pafStage: isPaf ? 'Kick-Off & Diagnóstico' : undefined,
    pafConsultingHoursTotal: isPaf ? (f.plan === 'paf_pro' ? 26 : 14) : undefined,
    pafConsultingHoursDone: isPaf ? 0 : undefined,
    pafMilestones: milestones,
    startDate: today,
    // Arranque listo para revisar: el tema Arranque empezado (tareas ocultas), el alcance y la bienvenida (sin publicar)
    ...(isPaf ? {
      pafAlcance: f.alcance || [],
      pafTemas: { arranque: { empezado: today } },
      pafTareas: kitDelTema(temaPorId('arranque'), { tareas: [], entregas: [] }, (() => { let i = 0; return () => `t_${stamp}_${i++}`; })()).tareas,
      pafHistorial: [{ fecha: now.toISOString(), texto: 'Cliente creado; empezó el tema Arranque' }],
      pafAnuncios: [{ id: `a_${stamp}`, ...BIENVENIDA_PAF, publicado: false, fijado: true, creadoEn: now.toISOString() }],
    } : {}),
  };
}
