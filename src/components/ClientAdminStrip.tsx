import React from 'react';
import { CalendarDays, MessageCircle, Plus } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import type { ProjectBillingSummary } from '../utils/paymentPlans';
import { nextMeeting } from '../portal/model';

/**
 * Lo administrativo del cliente, en una franja: cuánto es, cuánto pagó, cuánto falta,
 * el próximo cobro y la próxima reunión. Solo lo ve Juan.
 */
export const ClientAdminStrip: React.FC<{
  project: Project;
  billing: ProjectBillingSummary;
  meetings: AgendaMeeting[];
  privacyMode?: boolean;
  onRegisterPayment: () => void;
  onWhatsappCobro: () => void;
}> = ({ project, billing, meetings, privacyMode, onRegisterPayment, onWhatsappCobro }) => {
  const money = (n: number) => (privacyMode ? '••••' : `${billing.currency === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`);
  const today = new Date().toLocaleDateString('en-CA');

  // Próximo cobro: la primera cuota sin pagar, o el próximo compromiso
  const cuota = [...(project.installments || [])].filter((i) => !i.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const abono = (project.recurringPlans || []).find((r) => r.active);
  const proximo = cuota ? { fecha: cuota.dueDate, monto: cuota.amount } : billing.nextCommitment ? { fecha: billing.nextCommitment.dueDate, monto: billing.nextCommitment.amount } : abono ? { fecha: abono.nextDueDate, monto: abono.amount } : null;
  const vencido = !!proximo && proximo.fecha < today;
  const reunion = nextMeeting(meetings, project.id, today);
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 space-y-4" aria-label="Administración">
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Precio" value={billing.montoAcordado ? money(billing.montoAcordado) : abono ? `${privacyMode ? '••••' : `${abono.currency === 'USD' ? 'US$' : '$'} ${Math.round(abono.amount).toLocaleString('es-AR')}`}/mes` : 'Sin precio'} />
        <Figure label="Cobrado" value={money(billing.totalCobrado)} />
        <Figure label="Falta" value={money(billing.saldoPendiente)} />
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden" aria-hidden>
        <div className="h-full bg-zinc-100" style={{ width: `${Math.min(100, billing.porcentajeCobrado)}%` }} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <p className="flex items-center gap-2 text-zinc-400">
          <span className={`w-1.5 h-1.5 rounded-full ${vencido ? 'bg-rose-500' : proximo ? 'bg-zinc-500' : 'bg-emerald-500'}`} aria-hidden />
          {proximo ? <>Próximo cobro: <span className="text-zinc-100">{money(proximo.monto)} · {fmt(proximo.fecha)}</span>{vencido && <span className="text-rose-400"> vencido</span>}</> : billing.saldoPendiente > 0 ? 'Sin fecha de cobro acordada' : 'Al día'}
        </p>
        <p className="flex items-center gap-2 text-zinc-400">
          <CalendarDays className="w-3.5 h-3.5" />
          {reunion ? <>Próxima reunión: <span className="text-zinc-100">{fmt(reunion.fecha)}{reunion.hora ? ` · ${reunion.hora}` : ''}</span></> : 'Sin reunión agendada'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRegisterPayment} className="btn-solid-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus className="w-3.5 h-3.5" />Registrar pago</button>
        {billing.saldoPendiente > 0 && (
          <button type="button" onClick={onWhatsappCobro} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"><MessageCircle className="w-3.5 h-3.5" />WhatsApp de cobro</button>
        )}
      </div>
    </section>
  );
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}
