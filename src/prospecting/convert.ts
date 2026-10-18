import type { Project, Prospect } from '../types';
import { normalizeInstagram } from './core';

/** Datos del cliente nuevo cuando un prospecto pasa a ser cliente (se usa en Prospección y en el tablero) */
export function prospectToProject(p: Prospect, today: string): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    clientName: p.studio || p.name,
    ownerName: p.name,
    status: 'En curso',
    notes: [
      `Vino de prospección (${p.source || 'en frío'}).`,
      p.audit ? `Auto auditoría: ${p.audit.total}/30, nivel ${p.audit.nivel}. Dolor: ${p.audit.dolorCaptacion || '—'}.` : '',
      p.notes || '',
    ]
      .filter(Boolean)
      .join('\n'),
    archived: false,
    clientPhone: p.whatsapp,
    instagramUrl: p.instagram ? `https://instagram.com/${normalizeInstagram(p.instagram)}` : undefined,
    projectType: 'paf_pro',
    serviceType: 'paf',
    rubro: p.audit?.dedicacion,
    lastContactDate: today,
    ...(p.dealValue ? { estimatedPrice: p.dealValue, estimatedCurrency: p.dealCurrency || 'USD' } : {}),
  } as any;
}
