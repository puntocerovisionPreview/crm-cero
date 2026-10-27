import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MessageCircle, Search } from 'lucide-react';
import type { Prospect, ProspectEvent } from '../types';
import { buildDayLog, EVENT_LABELS } from '../prospecting/dayLog';
import { ACTION_LOG, STAGE_LABELS, type ProspectAction } from '../prospecting/core';
import { addDays, parseLocalDate } from '../utils/dates';
import { formatWhatsAppUrl } from '../utils/contact';

type View = 'pending' | 'sent' | 'replies' | 'history';
const button = 'px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] disabled:opacity-40';
const panel = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]';

export function ProspectingDailyDesk({ prospects, events, today, pendingCount, overflow, loading, error, onAct, onDetail, children }: {
  prospects: Prospect[]; events: ProspectEvent[]; today: string; pendingCount: number; overflow: number;
  loading?: boolean; error?: string | null;
  onAct: (p: Prospect, a: ProspectAction) => Promise<void> | void;
  onDetail?: (p: Prospect) => void;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<View>('pending');
  const [historyDate, setHistoryDate] = useState(today);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false);
  const date = view === 'history' ? historyDate : today;
  const day = useMemo(() => buildDayLog(prospects, events, date), [prospects, events, date]);
  const current = useMemo(() => buildDayLog(prospects, events, today), [prospects, events, today]);
  const entries = (view === 'sent' ? day.sent : view === 'replies' ? day.replies : day.all)
    .filter(c => (c.name + ' ' + (c.prospect?.name || '')).toLowerCase().includes(search.trim().toLowerCase()));
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: 'pending', label: 'Por hacer', count: pendingCount },
    { id: 'sent', label: 'Enviados hoy', count: current.sent.length },
    { id: 'replies', label: 'Respondieron hoy', count: current.replies.length },
    { id: 'history', label: 'Historial por día' },
  ];
  const outcome = async (p: Prospect, action: ProspectAction) => {
    if (locked.current) return;
    locked.current = true; setBusy(p.id);
    try { await onAct(p, action); } catch { /* El panel padre muestra el error sin confirmar el cambio. */ }
    finally { locked.current = false; setBusy(null); }
  };
  const time = (iso: string) => iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' }) : 'Sin hora';
  return <div className="space-y-4">
    <section className={panel + ' p-4 space-y-4'} aria-label="Seguimiento diario de prospección">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Tu día de prospección</h2>
        <p className="text-sm text-[var(--text-secondary)] capitalize">{parseLocalDate(today).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tabs.map(t => <button key={t.id} type="button" onClick={() => { setView(t.id); setSearch(''); }}
          aria-pressed={view === t.id}
          className={'p-3 rounded-xl text-left border transition ' + (view === t.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)]')}>
          <span className="block text-xs text-[var(--text-secondary)]">{t.label}</span>
          <span className="block text-xl font-bold text-[var(--text-primary)] tabular-nums">{t.count !== undefined ? (t.id === 'pending' || (!loading && !error) ? t.count : '…') : 'Ver días'}</span>
        </button>)}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">Abrir WhatsApp o copiar el texto no registra un envío. Al volver, tocá «Ya envié el mensaje» para guardarlo acá.</p>
      {view === 'pending' && overflow > 0 && <p className="text-xs text-amber-400">Hay {overflow} acciones adicionales fuera del cupo diario. Siguen pendientes; no se enviaron ni se pasaron de fecha.</p>}
      {error && <p role="alert" className="text-sm text-red-400">No pudimos cargar el historial. Los contadores pueden estar incompletos. Revisá la conexión.</p>}
    </section>
    {view === 'pending' ? children : <section className={panel + ' p-4 space-y-4'}>
      <div className="flex gap-2 items-center flex-wrap">
        <h2 className="font-semibold text-[var(--text-primary)] flex-1">{view === 'history' ? 'Actividad del día' : view === 'sent' ? 'A quién le escribiste hoy' : 'Quién respondió hoy'}</h2>
        {view === 'history' && <div className="flex items-center gap-1">
          <button type="button" className={button} aria-label="Día anterior" onClick={() => setHistoryDate(addDays(historyDate, -1))}><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" aria-label="Fecha del historial" max={today} value={historyDate} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value <= today) setHistoryDate(e.target.value); }} className={button + ' bg-[var(--bg-app)]'} />
          <button type="button" className={button} disabled={historyDate >= today} aria-label="Día siguiente" onClick={() => setHistoryDate(addDays(historyDate, 1))}><ChevronRight className="w-4 h-4" /></button>
          <button type="button" className={button} onClick={() => setHistoryDate(today)}>Hoy</button>
        </div>}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{day.sent.length} contactos · {day.messages} envíos registrados · {day.firstContacts} primeros contactos · {day.followUps} seguimientos · {day.replies.length} respondieron</p>
      <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3">
        <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar un contacto en este día" aria-label="Buscar en el registro diario" className="w-full py-2 bg-transparent text-sm text-[var(--text-primary)] outline-none" />
      </label>
      {loading ? <p className="text-sm text-[var(--text-secondary)]">Cargando actividad…</p> : entries.length === 0 ?
        <p className="text-sm text-[var(--text-secondary)] py-4">{search ? 'No hay contactos que coincidan con tu búsqueda.' : 'Todavía no hay registros en esta vista. Los envíos aparecen al confirmarlos.'}</p> :
        <ul className="space-y-3">{entries.map(c => {
          const p = c.prospect;
          const response = c.events.find(e => ['reply', 'conversation_reply', 'no_reply', 'lost', 'won'].includes(e.type));
          return <li key={c.id} className="rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] p-3 space-y-2">
            <div className="flex gap-2 items-start justify-between">
              <div><p className="font-semibold text-sm text-[var(--text-primary)]">{c.name}</p>
                {date === today && p && <p className="text-xs text-[var(--text-secondary)]">Ahora: {STAGE_LABELS[p.stage]}{p.nextActionDate ? ' · Próxima acción: ' + p.nextActionDate.split('-').reverse().join('/') : ''}</p>}
              </div>
              {c.sent && <span className="text-xs text-emerald-400 flex items-center gap-1 shrink-0"><Check className="w-3 h-3" /> Envío registrado</span>}
            </div>
            <ul className="space-y-1">{c.events.map(e => <li key={e.id} className="text-xs text-[var(--text-secondary)] flex gap-2">
              <time className="tabular-nums shrink-0">{time(e.createdAt)}</time>
              <span>{(e.action && ACTION_LOG[e.action]) || EVENT_LABELS[e.type] || e.type}{e.note ? ' · ' + e.note : ''}</span>
            </li>)}</ul>
            {date === today && p && c.sent && !['cliente', 'descartado'].includes(p.stage) && <fieldset disabled={busy !== null} className="flex flex-wrap gap-2 pt-1">
              {onDetail && <button type="button" className={button} onClick={() => onDetail(p)}>Ver contacto y seguir</button>}
              {p.whatsapp && <a className={button + ' inline-flex items-center gap-1'} href={formatWhatsAppUrl(p.whatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-3 h-3" /> Abrir chat</a>}
              {!response && <>
                <button type="button" className={button} onClick={() => outcome(p, 'they_replied')}>Respondió</button>
                <button type="button" className={button} onClick={() => outcome(p, 'no_reply')}>Todavía no respondió</button>
              </>}
              {response?.type === 'no_reply' && <button type="button" className={button} onClick={() => outcome(p, 'they_replied')}>Ahora sí respondió</button>}
              {busy === c.id && <span role="status" className="text-xs text-[var(--text-secondary)]">Guardando…</span>}
            </fieldset>}
          </li>;
        })}</ul>}
      <button type="button" className={button} onClick={() => setView('pending')}>Volver a lo pendiente{overflow > 0 ? ' (' + overflow + ' fuera del cupo)' : ''}</button>
    </section>}
  </div>;
}
