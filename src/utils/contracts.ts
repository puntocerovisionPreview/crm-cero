import type { BillingAgreement, BillingInstallment, Project } from '../types';

/**
 * CONTRATOS DENTRO DEL PRESUPUESTO (lógica pura: la usan la app y el servidor)
 *
 * - Cláusulas por tipo de servicio (web / PAF / otro), editables antes de enviar.
 * - Forma de pago (anticipo, contra entrega, cuotas) que el cliente ve con montos.
 * - Al aceptar o firmar: proyecto + plan de cobro + tareas de arranque, solos.
 *
 * Las plantillas son un punto de partida razonable, no asesoramiento legal: conviene que
 * un abogado las revise una vez.
 */

export type ContractService = 'web' | 'paf' | 'otro';

export interface ContractClause {
  title: string;
  body: string;
}

export interface PaymentStep {
  label: string; // "Anticipo", "Contra entrega", "Cuota 2"
  percent: number; // 0-100
  due: 'firma' | 'entrega' | 'dias';
  days?: number; // si due = 'dias': días desde la firma
}

export const SERVICE_LABELS: Record<ContractService, string> = { web: 'Sitio web', paf: 'Programa PAF', otro: 'Otro servicio' };

export const PAYMENT_PRESETS: { id: string; label: string; steps: PaymentStep[] }[] = [
  {
    id: '50-50',
    label: '50% al firmar · 50% contra entrega',
    steps: [
      { label: 'Anticipo', percent: 50, due: 'firma' },
      { label: 'Saldo', percent: 50, due: 'entrega' },
    ],
  },
  { id: 'unico', label: '100% al firmar', steps: [{ label: 'Pago único', percent: 100, due: 'firma' }] },
  {
    id: '3-cuotas',
    label: '3 cuotas mensuales',
    steps: [
      { label: 'Cuota 1', percent: 34, due: 'firma' },
      { label: 'Cuota 2', percent: 33, due: 'dias', days: 30 },
      { label: 'Cuota 3', percent: 33, due: 'dias', days: 60 },
    ],
  },
  {
    id: '2-cuotas',
    label: '2 cuotas (hoy y a 30 días)',
    steps: [
      { label: 'Cuota 1', percent: 50, due: 'firma' },
      { label: 'Cuota 2', percent: 50, due: 'dias', days: 30 },
    ],
  },
];

const STUDIO = 'Punto Cero';

/** Cláusulas base según el servicio. */
export function buildClauses(
  service: ContractService,
  opts: { deliveryDays: number; revisions: number; currency: 'ARS' | 'USD' }
): ContractClause[] {
  const pausa: ContractClause = {
    title: 'Pagos y atrasos',
    body: 'Los pagos se hacen según la forma de pago de este documento. Si un pago se atrasa más de 10 días, el trabajo se pausa hasta que se regularice, y los plazos se corren por el mismo tiempo.',
  };
  const ajuste: ContractClause[] =
    opts.currency === 'ARS'
      ? [
          {
            title: 'Ajuste de montos en pesos',
            body: 'Los montos en pesos valen durante la validez de este presupuesto. Los pagos posteriores al primero se ajustan según la variación del dólar oficial vendedor del Banco Nación entre la fecha de aceptación y la fecha de cada pago.',
          },
        ]
      : [];
  const confidencialidad: ContractClause = {
    title: 'Confidencialidad',
    body: `${STUDIO} y el cliente mantienen en reserva la información del otro a la que accedan por este trabajo (datos de clientes, accesos, números del negocio).`,
  };

  if (service === 'paf') {
    return [
      { title: 'Qué incluye', body: `${STUDIO} brinda el Programa PAF de acompañamiento con el alcance detallado en este presupuesto. Lo que no esté listado se cotiza aparte.` },
      {
        title: 'Duración y sesiones',
        body: `El programa dura ${opts.deliveryDays} días desde la primera sesión. Las sesiones se agendan con al menos 24 horas de anticipación; si se cancelan con menos aviso se cuentan como realizadas. Las horas no usadas dentro de ese plazo no se acumulan.`,
      },
      {
        title: 'Compromiso y resultados',
        body: 'Los resultados dependen de que el cliente implemente lo trabajado en las sesiones. Se garantiza el acompañamiento y las herramientas, no un número de clientes o ventas.',
      },
      pausa,
      ...ajuste,
      { title: 'Materiales', body: 'Las plantillas, guías y grabaciones son para uso del cliente y su estudio. No se pueden revender ni compartir con terceros.' },
      {
        title: 'Cancelación',
        body: 'Dentro de los primeros 7 días se puede cancelar y se devuelve lo abonado menos las sesiones realizadas. Después de ese plazo no hay devoluciones.',
      },
      confidencialidad,
    ];
  }

  if (service === 'web') {
    return [
      { title: 'Qué incluye', body: `${STUDIO} realiza los trabajos detallados en este presupuesto. Cualquier sección, función o pedido que no esté listado se cotiza aparte.` },
      {
        title: 'Plazos y contenido',
        body: `El plazo estimado es de ${opts.deliveryDays} días hábiles desde que se recibe el anticipo y todo el contenido (textos, fotos, logos y accesos). Si el contenido llega tarde, el plazo se corre por el mismo tiempo.`,
      },
      {
        title: 'Revisiones',
        body: `Incluye ${opts.revisions} ${opts.revisions === 1 ? 'ronda' : 'rondas'} de ajustes. Los cambios adicionales o fuera del alcance se cotizan aparte.`,
      },
      { title: 'Contenido del cliente', body: 'El cliente garantiza que tiene los derechos de los textos, imágenes y marcas que entrega para el sitio.' },
      pausa,
      ...ajuste,
      {
        title: 'Propiedad',
        body: `Una vez pagado el total, el cliente es dueño del sitio, del dominio y de los diseños finales. ${STUDIO} puede mostrar el trabajo en su portfolio, salvo que el cliente pida lo contrario.`,
      },
      { title: 'Servicios de terceros', body: 'Dominio, hosting y servicios externos (plugins, tipografías pagas, etc.) corren por cuenta del cliente, salvo que figuren en el detalle.' },
      {
        title: 'Cancelación',
        body: `Si el cliente cancela, lo abonado cubre el trabajo hecho hasta ese momento y no se devuelve. Si cancela ${STUDIO}, devuelve lo cobrado por el trabajo no entregado.`,
      },
      confidencialidad,
    ];
  }

  return [
    { title: 'Qué incluye', body: `${STUDIO} realiza los trabajos detallados en este presupuesto. Lo que no esté listado se cotiza aparte.` },
    { title: 'Plazos', body: `El plazo estimado es de ${opts.deliveryDays} días desde la aceptación y el primer pago.` },
    pausa,
    ...ajuste,
    confidencialidad,
  ];
}

const addDaysIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

/** Montos de cada paso (el último absorbe el redondeo para que sume justo el total). */
export function planAmounts(steps: PaymentStep[], total: number): number[] {
  if (!steps.length) return [];
  const sum = steps.reduce((s, x) => s + x.percent, 0) || 100;
  const amounts = steps.map((x) => Math.round((total * x.percent) / sum));
  amounts[amounts.length - 1] = total - amounts.slice(0, -1).reduce((s, x) => s + x, 0);
  return amounts;
}

export function stepDueDate(step: PaymentStep, acceptedOn: string, deliveryDays = 30): string {
  if (step.due === 'firma') return acceptedOn;
  if (step.due === 'entrega') return addDaysIso(acceptedOn, deliveryDays);
  return addDaysIso(acceptedOn, step.days || 30);
}

export function stepWhen(step: PaymentStep): string {
  return step.due === 'firma' ? 'al aceptar' : step.due === 'entrega' ? 'contra entrega' : `a los ${step.days || 30} días`;
}

/** Lo mínimo del presupuesto que hace falta para dar de alta el proyecto. */
export interface AcceptedDoc {
  id: string;
  number: number;
  projectId?: string;
  prospectId?: string;
  clientName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  currency: 'ARS' | 'USD';
  service?: ContractService;
  deliveryDays?: number;
  paymentPlan?: PaymentStep[];
}

export function docTotalOf(d: Pick<AcceptedDoc, 'items'>): number {
  return (d.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
}

/** Plan de cobro del proyecto a partir de la forma de pago del presupuesto. */
export function agreementFromDoc(d: AcceptedDoc, acceptedOn: string): BillingAgreement {
  const total = docTotalOf(d);
  const steps = d.paymentPlan?.length ? d.paymentPlan : PAYMENT_PRESETS[0].steps;
  const amounts = planAmounts(steps, total);
  const installments: BillingInstallment[] = steps.map((s, i) => ({
    id: `inst_${d.id}_${i + 1}`,
    number: i + 1,
    totalInstallments: steps.length,
    title: `${s.label} (${s.percent}%)`,
    dueDate: stepDueDate(s, acceptedOn, d.deliveryDays),
    expectedAmount: amounts[i],
    currency: d.currency,
    actualPaidAmount: 0,
    status: i === 0 ? 'pendiente' : 'futuro',
  }));
  return {
    id: `agr_${d.id}`,
    type: steps.length === 1 ? 'unico' : steps.some((s) => s.due === 'entrega') ? 'hitos' : 'cuotas',
    title: `Presupuesto N° ${String(d.number).padStart(4, '0')}`,
    currency: d.currency,
    totalAmount: total,
    installmentsCount: steps.length,
    startDate: acceptedOn,
    endDate: installments[installments.length - 1]?.dueDate,
    notes: 'Creado solo al aceptar el presupuesto.',
    installments,
  };
}

/** Proyecto nuevo (si el presupuesto no estaba atado a uno) y tareas de arranque. */
export function onboardingFromDoc(d: AcceptedDoc, acceptedOn: string, nowIso: string) {
  const service = d.service || 'otro';
  const agreement = agreementFromDoc(d, acceptedOn);
  const total = agreement.totalAmount || 0;
  const project: Project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    clientName: d.clientName,
    ownerName: d.contactName,
    status: 'En curso',
    notes: `Aceptó el presupuesto N° ${String(d.number).padStart(4, '0')} el ${acceptedOn}.`,
    archived: false,
    createdAt: acceptedOn,
    updatedAt: acceptedOn,
    clientPhone: d.phone,
    clientEmail: d.email,
    serviceType: service === 'otro' ? 'otro' : service,
    projectType: service === 'paf' ? 'paf_pro' : service === 'web' ? 'web' : 'otro',
    startDate: acceptedOn,
    deliveryDate: addDaysIso(acceptedOn, d.deliveryDays || 30),
    estimatedPrice: total,
    estimatedCurrency: d.currency,
    montoAcordado: total,
    billingAgreement: agreement,
    lastContactDate: acceptedOn,
  } as Project;

  const task = (n: number, title: string, inDays: number) => ({
    id: `task_doc_${d.id}_${n}`,
    title,
    date: addDaysIso(acceptedOn, inDays),
    completed: false,
    priority: 'alta' as const,
    createdAt: acceptedOn,
    projectName: d.clientName,
  });
  const tasks =
    service === 'paf'
      ? [task(1, `Agendar la primera sesión PAF con ${d.clientName}`, 0), task(2, `Mandar bienvenida y materiales a ${d.clientName}`, 1)]
      : service === 'web'
      ? [task(1, `Kick-off con ${d.clientName}: alcance y fechas`, 1), task(2, `Pedir contenido (textos, fotos, logo, accesos) a ${d.clientName}`, 1)]
      : [task(1, `Arrancar el trabajo para ${d.clientName}`, 1)];
  return { project, agreement, tasks, nowIso };
}
