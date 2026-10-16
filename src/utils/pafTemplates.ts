import { PafMilestone } from '../types';
import { PAF_PRO_CATALOG, PAF_BASE_CATALOG } from './pricingCatalog';

export const PAF_PRO_MILESTONES: Omit<PafMilestone, 'id' | 'completed'>[] = [
  // MES 1: INFRAESTRUCTURA & PRESENCIA DIGITAL
  {
    title: 'Kick-Off & Definición de Nicho de Autor y Oferta Irresistible',
    month: 1,
    week: 1,
    pillar: 'presencia',
  },
  {
    title: 'Desarrollo y Entrega de Página Web / Landing Page Comercial de Alta Conversión',
    month: 1,
    week: 2,
    pillar: 'presencia',
  },
  {
    title: 'Optimización SEO Local en Ficha Google Business Profile (Maps)',
    month: 1,
    week: 3,
    pillar: 'presencia',
  },
  {
    title: 'Reestructuración y Alineación de Instagram Institucional',
    month: 1,
    week: 4,
    pillar: 'presencia',
  },

  // MES 2: ADQUISICIÓN & CAPTACIÓN
  {
    title: 'Calendario Editorial de Contenidos (30 días) y Guionado Orgánico',
    month: 2,
    week: 5,
    pillar: 'adquisicion',
  },
  {
    title: 'Producción, Guionado y Lanzamiento de VSL (Video Sales Letter)',
    month: 2,
    week: 6,
    pillar: 'adquisicion',
  },
  {
    title: 'Setup e Implementación de Lead Scoring (A/B/C por terreno, plazo y presupuesto)',
    month: 2,
    week: 7,
    pillar: 'conversion',
  },
  {
    title: 'Setup y Lanzamiento de Campañas Hiper-segmentadas en Meta Ads',
    month: 2,
    week: 8,
    pillar: 'adquisicion',
  },

  // MES 3: CONVERSIÓN, CIERRES & ECOSISTEMA
  {
    title: 'Optimización Activa de Pauta Publicitaria y Métricas de Captación',
    month: 3,
    week: 9,
    pillar: 'adquisicion',
  },
  {
    title: 'Auditoría y Soporte Directo en Llamadas Comerciales y Cierres de Ventas',
    month: 3,
    week: 10,
    pillar: 'conversion',
  },
  {
    title: 'Entrega de Librería de Prompts IA .Cero + PDFs Educativos para Prospectos',
    month: 3,
    week: 11,
    pillar: 'general',
  },
  {
    title: 'Consolidación y Cierre del Ecosistema PAF + Plan de Escalabilidad Continua',
    month: 3,
    week: 12,
    pillar: 'general',
  },
];

export const PAF_BASE_MILESTONES: Omit<PafMilestone, 'id' | 'completed'>[] = [
  // Pilar 1: Presencia Digital
  {
    title: 'Workshop de Fundaciones: Nicho de Autor y Oferta Irresistible',
    month: 1,
    week: 1,
    pillar: 'presencia',
  },
  {
    title: 'Auditoría y Setup de Perfiles: Instagram Institucional y Google Business Profile',
    month: 1,
    week: 2,
    pillar: 'presencia',
  },
  {
    title: 'Despliegue de Landing Page Comercial enfocada en Conversión',
    month: 1,
    week: 3,
    pillar: 'presencia',
  },
  // Pilar 2: Adquisición
  {
    title: 'Toolkit Orgánico: Calendario 30 días, pilares y fórmulas de Copywriting',
    month: 2,
    week: 5,
    pillar: 'adquisicion',
  },
  {
    title: 'Guiones de Video probados para Reels y VSL educativo',
    month: 2,
    week: 6,
    pillar: 'adquisicion',
  },
  {
    title: 'Taller Meta Ads: Configuración, segmentación y encendido de campañas',
    month: 2,
    week: 7,
    pillar: 'adquisicion',
  },
  // Pilar 3: Funnel de Conversión
  {
    title: 'Pre-calificación: Formularios para filtrar por terreno, plazo y presupuesto',
    month: 3,
    week: 9,
    pillar: 'conversion',
  },
  {
    title: 'Protocolo de Respuestas: Scripts para encauzar consultas informales de redes',
    month: 3,
    week: 10,
    pillar: 'conversion',
  },
  {
    title: 'Reunión Comercial: Guion para llamadas de venta y rebatir objeciones de honorarios',
    month: 3,
    week: 11,
    pillar: 'conversion',
  },
];

export interface PafPricingOption {
  id: '1_pago' | '2_pagos' | '3_pagos';
  name: string;
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  currency: 'ARS';
  badge?: string;
  description: string;
}

const proPlans = PAF_PRO_CATALOG.getPlans(true);
export const PAF_PRO_PRICING: PafPricingOption[] = [
  {
    id: '1_pago',
    name: '1 Pago Único Promocional',
    installments: 1,
    installmentAmount: proPlans[0].installmentAmount,
    totalAmount: proPlans[0].totalAmount,
    currency: 'ARS',
    badge: 'Recomendado (-$200.000)',
    description: 'Exclusivo confirmando el inicio durante la reunión comercial (Precio regular: $1.300.000).',
  },
  {
    id: '2_pagos',
    name: 'Plan 2 Pagos',
    installments: 2,
    installmentAmount: proPlans[1].installmentAmount,
    totalAmount: proPlans[1].totalAmount,
    currency: 'ARS',
    description: '1° pago al inicio + 2° pago a los 30 días.',
  },
  {
    id: '3_pagos',
    name: 'Plan 3 Pagos',
    installments: 3,
    installmentAmount: proPlans[2].installmentAmount,
    totalAmount: proPlans[2].totalAmount,
    currency: 'ARS',
    description: '3 cuotas mensuales durante los 3 meses del programa.',
  },
];

const basePlans = PAF_BASE_CATALOG.getPlans();
export const PAF_BASE_PRICING: PafPricingOption[] = [
  {
    id: '1_pago',
    name: '1 Pago Único',
    installments: 1,
    installmentAmount: basePlans[0].installmentAmount,
    totalAmount: basePlans[0].totalAmount,
    currency: 'ARS',
    badge: 'Ahorro',
    description: 'Pago total único al inicio del programa base.',
  },
  {
    id: '2_pagos',
    name: 'Plan 2 Pagos',
    installments: 2,
    installmentAmount: basePlans[1].installmentAmount,
    totalAmount: basePlans[1].totalAmount,
    currency: 'ARS',
    description: `2 cuotas de $${(basePlans[1].installmentAmount).toLocaleString('es-AR')} ARS.`,
  },
  {
    id: '3_pagos',
    name: 'Plan 3 Pagos',
    installments: 3,
    installmentAmount: basePlans[2].installmentAmount,
    totalAmount: basePlans[2].totalAmount,
    currency: 'ARS',
    description: `3 cuotas mensuales de $${(basePlans[2].installmentAmount).toLocaleString('es-AR')} ARS.`,
  },
];

// Lead Scoring Guía para Arquitectos
export const PAF_LEAD_SCORING_INFO = {
  A: {
    label: 'Lead A (Calificado Inmediato)',
    color: 'emerald',
    badge: 'A - Cierre Prioritario',
    criteria: 'Tiene terreno escriturado, plazo de inicio menor a 6 meses, y presupuesto acorde.',
    action: 'Agendar llamada comercial inmediata. Presentar propuesta con urgencia.',
  },
  B: {
    label: 'Lead B (Potencial en Maduración)',
    color: 'amber',
    badge: 'B - En Seguimiento',
    criteria: 'Tiene intención firme pero aún busca lote o planea iniciar en 6-12 meses.',
    action: 'Nutrir con VSL y PDF educativo ("Paso a paso para planificar tu vivienda sin sobrecostos").',
  },
  C: {
    label: 'Lead C (Curioso / No Calificado)',
    color: 'zinc',
    badge: 'C - Descartado / Derivado',
    criteria: 'Solo pide "precio por m2", no tiene terreno ni presupuesto viable.',
    action: 'Enviar protocolo de respuestas automático para no regalar horas de anteproyecto.',
  },
};

// Hitos de Salida Clave por Etapa (Gating / Requisitos para desbloquear avance)
export const DEFAULT_PAF_STAGE_EXIT_MILESTONES: Record<string, { id: string; text: string }[]> = {
  'Kick-Off & Diagnóstico': [
    { id: 'm0-1', text: 'Entrevista de diagnóstico inicial y auditoría de proyectos anteriores' },
    { id: 'm0-2', text: 'Definición del cliente comitente ideal (perfil de alta rentabilidad)' },
    { id: 'm0-3', text: 'Acuerdo de calendario y fijación de objetivos a 90 días' },
  ],
  'Mes 1: Infra & Web': [
    { id: 'm1-1', text: 'Nicho de Autor y Oferta Irresistible formalizada por escrito' },
    { id: 'm1-2', text: 'Landing page comercial / web publicada y testeada' },
    { id: 'm1-3', text: 'Google Business Profile optimizado con fotos y reseñas clave' },
  ],
  'Mes 2: Ads & VSL': [
    { id: 'm2-1', text: 'Guion y grabación del VSL Funnel (Video Sales Letter)' },
    { id: 'm2-2', text: 'Campaña en Meta Ads activa con formulario de pre-calificación' },
    { id: 'm2-3', text: 'Calendario de 12 contenidos orgánicos planificados' },
  ],
  'Mes 3: Cierres': [
    { id: 'm3-1', text: 'Matriz de Lead Scoring implementada (A/B/C por terreno y plazo)' },
    { id: 'm3-2', text: 'Script de llamada comercial ensayado y validado en reunión 1:1' },
    { id: 'm3-3', text: 'Propuesta comercial estandarizada en PDF/Figma con honorarios mínimos' },
  ],
  'Graduados': [
    { id: 'm4-1', text: 'Auditoría final de métricas de adquisición y comitentes cerrados' },
    { id: 'm4-2', text: 'Plan de mantenimiento del ecosistema publicitario a 6 meses' },
  ],
  // Legacy aliases for backward compatibility
  'Kick-off / Diagnóstico': [
    { id: 'm0-1', text: 'Entrevista de diagnóstico inicial y auditoría de proyectos anteriores' },
    { id: 'm0-2', text: 'Definición del cliente comitente ideal (perfil de alta rentabilidad)' },
    { id: 'm0-3', text: 'Acuerdo de calendario y fijación de objetivos a 90 días' },
  ],
  'Mes 1: Infraestructura & Web': [
    { id: 'm1-1', text: 'Nicho de Autor y Oferta Irresistible formalizada por escrito' },
    { id: 'm1-2', text: 'Landing page comercial / web publicada y testeada' },
    { id: 'm1-3', text: 'Google Business Profile optimizado con fotos y reseñas clave' },
  ],
  'Mes 2: Adquisición & Ads': [
    { id: 'm2-1', text: 'Guion y grabación del VSL Funnel (Video Sales Letter)' },
    { id: 'm2-2', text: 'Campaña en Meta Ads activa con formulario de pre-calificación' },
    { id: 'm2-3', text: 'Calendario de 12 contenidos orgánicos planificados' },
  ],
  'Mes 3: Conversión & Cierres': [
    { id: 'm3-1', text: 'Matriz de Lead Scoring implementada (A/B/C por terreno y plazo)' },
    { id: 'm3-2', text: 'Script de llamada comercial ensayado y validado en reunión 1:1' },
    { id: 'm3-3', text: 'Propuesta comercial estandarizada en PDF/Figma con honorarios mínimos' },
  ],
  'Completado / Graduado': [
    { id: 'm4-1', text: 'Auditoría final de métricas de adquisición y comitentes cerrados' },
    { id: 'm4-2', text: 'Plan de mantenimiento del ecosistema publicitario a 6 meses' },
  ],
};

// Función para calcular alerta de ritmo de consumo de horas vs tiempo
export function checkPafPacing(
  hoursUsed: number = 0,
  totalHours: number = 26,
  startDate?: string
): { isFast: boolean; percentHours: number; elapsedWeeks: number; message?: string } {
  if (!startDate) {
    return { isFast: false, percentHours: Math.round((hoursUsed / (totalHours || 26)) * 100), elapsedWeeks: 0 };
  }
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedWeeks = Math.max(1, Math.min(12, Math.ceil(diffDays / 7)));

  const percentHours = (hoursUsed / (totalHours || 26)) * 100;
  const expectedMaxPercent = (elapsedWeeks / 12) * 100 + 15; // Margen de tolerancia del 15%

  const isFast = percentHours > expectedMaxPercent && hoursUsed > 4;
  let message: string | undefined;

  if (isFast) {
    message = `Consumió el ${Math.round(percentHours)}% de horas en la semana ${elapsedWeeks} de 12. Ritmo acelerado (riesgo de agotar sesiones antes del Mes 3).`;
  }

  return { isFast, percentHours: Math.round(percentHours), elapsedWeeks, message };
}

// Plantillas de mensajes WhatsApp pre-armados con 1 clic para clientes arquitectos PAF
export function generatePafWhatsAppMessage(params: {
  clientName: string;
  hoursUsed: number;
  totalHours: number;
  stage?: string;
  type: 'recordatorio_sesion' | 'horas_restantes' | 'hitos_pendientes' | 'cuota_pendiente';
  installmentNumber?: number;
  installmentAmount?: number;
}): string {
  const { clientName, hoursUsed, totalHours, stage, type, installmentNumber, installmentAmount } = params;
  const remainingHours = Math.max(0, (totalHours || 26) - (hoursUsed || 0));

  switch (type) {
    case 'recordatorio_sesion':
      return `¡Hola ${clientName}! ¿Cómo estás? Te escribo desde .Cero para coordinar nuestra próxima sesión 1:1 del Método PAF. Tenés ${remainingHours} hs de consultoría disponibles. ¿Qué día y horario te queda mejor esta semana?`;
    case 'horas_restantes':
      return `¡Hola ${clientName}! Te comparto tu balance de mentoría PAF: llevamos realizadas ${hoursUsed} de ${totalHours || 26} horas de consultoría 1:1 (te restan ${remainingHours} hs). Venimos con excelente avance en ${stage || 'el programa'}.`;
    case 'hitos_pendientes':
      return `¡Hola ${clientName}! ¿Cómo venís con los entregables de ${stage || 'tu etapa actual'}? Avisame si necesitás una revisión antes de nuestra próxima llamada para que podamos validar los hitos y avanzar al siguiente módulo.`;
    case 'cuota_pendiente':
      return `¡Hola ${clientName}! Te contacto del estudio para enviarte el recordatorio de la cuota ${installmentNumber ? `#${installmentNumber}` : ''} del Método PAF${installmentAmount ? ` por $${installmentAmount.toLocaleString('es-AR')}` : ''}. Avisame cuando puedas realizarla y te emitimos el recibo correspondiente. ¡Muchas gracias!`;
    default:
      return `¡Hola ${clientName}! Te contacto desde .Cero respecto a tu programa Método PAF.`;
  }
}

// Protocolo de Objeciones en Llamadas de Venta (del Método PAF)
export const PAF_SALES_OBJECTIONS = [
  {
    objection: '"El boca en boca me funciona bien..."',
    rebuttal: 'El boca a boca es excelente, pero es impredecible. Cuando una obra termina, se abre un bache de incertidumbre donde terminás aceptando clientes no ideales o bajando honorarios. PAF no reemplaza tu boca a boca: le suma un canal predecible donde vos elegís con quién trabajar.',
  },
  {
    objection: '"No tengo tiempo para ponerme a hacer videos o redes..."',
    rebuttal: 'Justamente por eso no te pedimos ser influencer. Creamos un sistema con 1 VSL principal y guiones estratégicos ya estructurados. Con solo 2 horas de grabación al mes generamos todo el material que trabaja por vos las 24hs filtrando curiosos.',
  },
  {
    objection: '"Es una inversión alta para mi momento actual..."',
    rebuttal: 'Pensalo en metros cuadrados: con un solo comitente de vivienda unifamiliar o anteproyecto que cierre gracias al sistema, amortizás el 100% de la inversión y te queda la infraestructura instalada para siempre. Además tenés el plan en 3 cuotas para financiarlo mientras ya captás prospectos.',
  },
  {
    objection: '"La gente en mi ciudad no busca arquitectos por internet..."',
    rebuttal: 'En Google Maps e Instagram la gente busca activamente referencias antes de confiar una inversión de decenas de miles de dólares en su casa. Si no encuentran tu estudio con solvencia de autor, van con el que sí transmite autoridad inmediata.',
  },
];


