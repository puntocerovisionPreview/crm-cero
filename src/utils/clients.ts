import { AgendaMeeting, Client, IncomeRecord, Project } from '../types';
import { getCollectedEntries, sumByCurrency } from './ledger';
import { calculateProjectBilling, resolveProjectCurrency } from './paymentPlans';

/** "Estudio Cané  Arquitectura" → "estudio cane arquitectura": para agrupar por nombre */
export function normalizeClientName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ClientLinkPlan {
  newClients: Client[];
  projectLinks: { projectId: string; clientId: string }[];
}

/**
 * Qué hay que hacer para que cada proyecto tenga su cliente: vincula los proyectos sin
 * clientId con un cliente existente del mismo nombre, o crea el cliente con los datos
 * de contacto del proyecto. Es aditivo: no borra ni cambia nada más.
 */
export function planClientLinks(projects: Project[], clients: Client[], today: string): ClientLinkPlan {
  const byName = new Map<string, Client>();
  clients.forEach((c) => byName.set(normalizeClientName(c.name), c));
  const newClients: Client[] = [];
  const projectLinks: ClientLinkPlan['projectLinks'] = [];

  [...projects]
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .forEach((p) => {
      if (p.clientId || !p.clientName?.trim()) return;
      const key = normalizeClientName(p.clientName);
      if (!key) return;
      let client = byName.get(key);
      if (!client) {
        client = {
          id: `cli_${key.replace(/ /g, '_').slice(0, 40)}_${Math.random().toString(36).slice(2, 6)}`,
          name: p.clientName.trim(),
          phone: p.clientPhone || undefined,
          instagramUrl: p.instagramUrl || undefined,
          websiteUrl: p.websiteUrl || undefined,
          rubro: p.rubro || undefined,
          createdAt: (p.createdAt || today).slice(0, 10),
        };
        byName.set(key, client);
        newClients.push(client);
      }
      projectLinks.push({ projectId: p.id, clientId: client.id });
    });

  return { newClients, projectLinks };
}

export interface ClientSummary {
  client: Client;
  projects: Project[];
  activeProjects: number;
  collected: { ARS: number; USD: number };
  pending: { ARS: number; USD: number };
  lastContact?: string;
  phone?: string;
  hasDeliveredWebWithoutRetainer: boolean;
}

const INACTIVE_STATUSES = ['Entregado', 'No concretado', 'Pausado'];

export function summarizeClients(
  clients: Client[],
  projects: Project[],
  incomes: IncomeRecord[],
  meetings: AgendaMeeting[] = []
): ClientSummary[] {
  return clients
    .map((client) => {
      const own = projects.filter((p) => p.clientId === client.id);
      const ids = new Set(own.map((p) => p.id));
      const collected = sumByCurrency(
        getCollectedEntries(incomes, own, () => true).filter((e) => e.projectId && ids.has(e.projectId))
      );
      const pending = { ARS: 0, USD: 0 };
      own.forEach((p) => {
        if (p.archived) return;
        const b = calculateProjectBilling(p, incomes);
        if (b.saldoPendiente > 0) pending[resolveProjectCurrency(b.currency) === 'USD' ? 'USD' : 'ARS'] += b.saldoPendiente;
      });
      const contactDates = [
        ...own.map((p) => p.lastContactDate || ''),
        ...meetings.filter((m) => m.projectId && ids.has(m.projectId) && m.completed).map((m) => m.date),
      ].filter(Boolean);
      const lastContact = contactDates.sort().pop();
      const hasDeliveredWebWithoutRetainer =
        own.some((p) => p.projectType === 'web' && (p.status === 'Entregado' || p.statusOverride === 'completed')) &&
        !own.some((p) => (p.recurringPlans || []).length > 0);
      return {
        client,
        projects: own.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        activeProjects: own.filter((p) => !p.archived && !INACTIVE_STATUSES.includes(p.status)).length,
        collected,
        pending,
        lastContact,
        phone: client.phone || own.find((p) => p.clientPhone)?.clientPhone,
        hasDeliveredWebWithoutRetainer,
      };
    })
    .filter((s) => s.projects.length > 0)
    .sort((a, b) => b.collected.USD + b.collected.ARS / 1000 - (a.collected.USD + a.collected.ARS / 1000));
}
