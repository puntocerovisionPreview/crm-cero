import type { Project, Prospect } from '../types';

/**
 * TABLERO DE OPORTUNIDADES
 * Junta en un solo embudo a los prospectos de la prospección (desde que responden)
 * y a los "posibles" de Clientes (proyectos en evaluación).
 * Los que todavía no respondieron se quedan en la cola de Prospección: acá no hacen ruido.
 */

export type PipelineColumn = 'conversacion' | 'llamada' | 'propuesta' | 'ganado' | 'perdido';

export const PIPELINE_COLUMNS: { key: PipelineColumn; label: string; hint: string; tint: string }[] = [
  { key: 'conversacion', label: 'En conversación', hint: 'Respondió, auditoría o video', tint: '#007AFF' },
  { key: 'llamada', label: 'Llamada', hint: 'Agendada o hecha', tint: '#5856D6' },
  { key: 'propuesta', label: 'Propuesta', hint: 'Esperando respuesta', tint: '#FF9500' },
  { key: 'ganado', label: 'Ganados este mes', hint: '', tint: '#34C759' },
  { key: 'perdido', label: 'Perdidos este mes', hint: '', tint: '#8E8E93' },
];

export interface PipelineItem {
  kind: 'prospect' | 'lead';
  id: string;
  title: string;
  subtitle?: string;
  column: PipelineColumn;
  value?: number;
  currency: 'ARS' | 'USD';
  /** Desde cuándo está en esta etapa (para ver lo que se estanca) */
  since?: string;
  prospect?: Prospect;
  project?: Project;
}

const CONVERSATION: Prospect['stage'][] = ['respondio', 'auditoria_enviada', 'auditoria_completada', 'video_enviado'];

export function prospectColumn(p: Prospect, month: string): PipelineColumn | null {
  if (CONVERSATION.includes(p.stage)) return 'conversacion';
  if (p.stage === 'llamada') return p.proposalSentAt ? 'propuesta' : 'llamada';
  const changed = (p.updatedAt || p.lastOutcomeAt || '').slice(0, 7);
  if (p.stage === 'cliente') return changed === month ? 'ganado' : null;
  if (p.stage === 'descartado') return changed === month && !p.doNotContact ? 'perdido' : null;
  return null; // nuevo / contactado: siguen en la cola de Prospección
}

export function buildPipeline(prospects: Prospect[], projects: Project[], today: string): PipelineItem[] {
  const month = today.slice(0, 7);
  const items: PipelineItem[] = [];

  prospects.forEach((p) => {
    const column = prospectColumn(p, month);
    if (!column) return;
    items.push({
      kind: 'prospect',
      id: p.id,
      title: p.studio || p.name,
      subtitle: p.studio ? p.name : p.city,
      column,
      value: p.dealValue,
      currency: p.dealCurrency || 'USD',
      since: column === 'propuesta' ? p.proposalSentAt : column === 'llamada' ? p.callDate || p.lastContactAt : p.lastContactAt || p.lastOutcomeAt,
      prospect: p,
    });
  });

  // Los "posibles" de Clientes ya están en etapa de propuesta
  projects
    .filter((p) => p.isLead && !p.archived)
    .forEach((p) => {
      items.push({
        kind: 'lead',
        id: p.id,
        title: p.clientName,
        subtitle: p.ownerName || p.rubro,
        column: 'propuesta',
        value: p.estimatedPrice,
        currency: p.estimatedCurrency || 'USD',
        since: p.lastContactDate || p.updatedAt?.slice(0, 10),
        project: p,
      });
    });

  return items;
}

/** Lo que está abierto (conversación, llamada y propuesta), por moneda */
export function openTotals(items: PipelineItem[]) {
  const open = items.filter((i) => ['conversacion', 'llamada', 'propuesta'].includes(i.column));
  return {
    count: open.length,
    ARS: open.filter((i) => i.currency === 'ARS').reduce((s, i) => s + (i.value || 0), 0),
    USD: open.filter((i) => i.currency === 'USD').reduce((s, i) => s + (i.value || 0), 0),
    sinValor: open.filter((i) => !i.value).length,
  };
}
