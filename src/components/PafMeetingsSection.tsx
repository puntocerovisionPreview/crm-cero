import React, { useEffect, useState } from 'react';
import { CalendarCheck, CalendarX, Check, ExternalLink, Loader2, Pencil, RefreshCw, Trash2, UserPlus, Video } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { getTodayString } from '../utils/storage';
import { getCalendarStatus, syncCalendarNow, type CalendarStatus } from '../utils/calendarSyncClient';
import { PafReunionCard, clientInviteEmails, googleCalendarLink } from './PafReunionCard';
import { PafMeetingSummaries } from './PafMeetingSummaries';

const field = 'rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';

/**
 * REUNIONES del cliente, todo junto: estado de Google Calendar, próximas (mover, marcar hecha,
 * borrar), agendar una nueva, link fijo de la sala y lo que acordamos.
 */
export const PafMeetingsSection: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  onUpdateMeeting?: (id: string, updates: Partial<AgendaMeeting>) => void;
  onToggleMeeting?: (id: string) => void;
  onDeleteMeeting?: (id: string) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  linkReunion: string;
  onLinkReunion: (v: string) => void;
  /** Abre el formulario (desde las acciones rápidas) */
  scheduling: boolean;
  onScheduling: (open: boolean) => void;
  writingSummary: boolean;
  onWritingSummary: (open: boolean) => void;
}> = (props) => {
  const { project, meetings } = props;
  const today = getTodayString();
  const mine = meetings.filter((m) => m.projectId === project.id);
  const upcoming = mine.filter((m) => !m.completed && m.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = mine.filter((m) => m.completed || m.date < today).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 5);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  useEffect(() => { getCalendarStatus().then(setStatus); }, []);

  return (
    <div className="space-y-5">
      <CalendarStatusLine status={status} />

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-xs font-bold text-zinc-100">Próximas</h3>
          {!props.scheduling && <button type="button" onClick={() => props.onScheduling(true)} className="btn-solid-primary px-3 py-1.5 text-xs">+ Agendar reunión</button>}
        </div>
        {props.scheduling && (
          <div className="rounded-xl border border-zinc-700 p-3">
            <PafReunionCard project={project} meetings={meetings} hideUpcoming calendarConnected={status?.connected}
              onAddMeeting={(m) => { props.onAddMeeting(m); props.onScheduling(false); }} onCancel={() => props.onScheduling(false)} />
          </div>
        )}
        {upcoming.length ? (
          <ul className="space-y-2">{upcoming.map((m, i) => <MeetingRow key={m.id} m={m} first={i === 0} connected={!!status?.connected} clientEmails={clientInviteEmails(project)} {...props} />)}</ul>
        ) : !props.scheduling && <p className="rounded-xl border border-dashed border-zinc-700 p-3 text-center text-xs text-zinc-500">Sin reuniones agendadas. El cliente ve “La vas a ver acá cuando la coordinemos”.</p>}
        {upcoming.length > 0 && <p className="text-[11px] text-zinc-500">El cliente ve la primera, con botones para unirse, agregarla a su calendario y pedirte reprogramar.</p>}
      </section>

      <section className="space-y-1.5">
        <h3 className="text-xs font-bold text-zinc-100">Sala de reunión</h3>
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 shrink-0 text-zinc-500" />
          <input className={`${field} flex-1`} value={props.linkReunion} placeholder="Link fijo de Meet o Zoom (https://meet.google.com/…)" onChange={(e) => props.onLinkReunion(e.target.value)} />
        </div>
        <p className="text-[11px] text-zinc-500">Si lo cargás, el cliente tiene un botón “Unirme”.</p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1"><h3 className="text-xs font-bold text-zinc-100">Lo que acordamos</h3><p className="text-[11px] text-zinc-500">Acuerdos y próximos pasos que ve el cliente. Tus notas privadas no se publican.</p></div>
          {!props.writingSummary && <button type="button" onClick={() => props.onWritingSummary(true)} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-200">+ Anotar acuerdos</button>}
        </div>
        <PafMeetingSummaries project={project} meetings={meetings} onUpdateProject={props.onUpdateProject} showForm={props.writingSummary} onDone={() => props.onWritingSummary(false)} bare />
      </section>

      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] font-bold text-zinc-400 hover:text-zinc-200">Anteriores ({past.length})</summary>
          <ul className="mt-2 space-y-1">
            {past.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-[11px] text-zinc-400">
                <Check className={`w-3 h-3 ${m.completed ? 'text-emerald-400' : 'text-zinc-600'}`} />
                <span className="flex-1 min-w-0 truncate">{fmtDate(m.date)}{m.time ? ` · ${m.time}` : ''} · {m.title}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function CalendarStatusLine({ status }: { status: CalendarStatus | null }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  if (!status) return <p className="text-[11px] text-zinc-500">Revisando Google Calendar…</p>;
  if (!status.connected) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-zinc-800 p-3">
        <CalendarX className="mt-0.5 w-4 h-4 shrink-0 text-zinc-500" />
        <div className="text-[11px] text-zinc-400 space-y-1">
          <p className="text-xs font-semibold text-zinc-200">Google Calendar no está conectado en el servidor</p>
          <p>Mientras tanto, al agendar se abre Google Calendar con el evento listo para guardar.</p>
          <p>Para que pase solo: en Google AI Studio → Secrets, cargá <span className="font-mono text-zinc-300">GOOGLE_CALENDAR_ID</span> con tu Gmail, y en Google Calendar compartí tu calendario con {status.serviceAccountEmail ? <span className="font-mono text-zinc-300">{status.serviceAccountEmail}</span> : 'la cuenta de servicio'} con permiso “Hacer cambios en los eventos”.</p>
        </div>
      </div>
    );
  }
  const sync = async () => {
    setSyncing(true); setMsg('');
    const err = await syncCalendarNow();
    setSyncing(false);
    setMsg(err || 'Listo: tu Calendar y el CRM están al día.');
  };
  return (
    <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
      <CalendarCheck className="w-4 h-4 text-emerald-400" />
      <span className="flex-1 min-w-0 text-[11px] text-zinc-300">Google Calendar conectado{status.calendarId ? ` · ${status.calendarId}` : ''}. Lo que agendás acá aparece ahí en segundos.</span>
      <button type="button" onClick={sync} disabled={syncing} className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-300 hover:text-zinc-100">
        {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Sincronizar ahora
      </button>
      {msg && <p role="status" className="w-full text-[11px] text-zinc-400">{msg}</p>}
    </div>
    {!status.invites && (
      <p className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] px-3 py-2 text-[11px] text-zinc-300">
        Para que al cliente le llegue la invitación: andá a Ajustes → Automatizaciones → Google Drive, tocá “Volver a conectar” y aceptá también <span className="text-zinc-100">Google Calendar</span>. Es una sola vez.
      </p>
    )}
    </div>
  );
}

function MeetingRow({ m, first, connected, clientEmails, onUpdateMeeting, onToggleMeeting, onDeleteMeeting, onWritingSummary }: {
  m: AgendaMeeting; first: boolean; connected: boolean; clientEmails: string[];
  onUpdateMeeting?: (id: string, updates: Partial<AgendaMeeting>) => void;
  onToggleMeeting?: (id: string) => void;
  onDeleteMeeting?: (id: string) => void;
  onWritingSummary: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ date: m.date, time: m.time || '', durationHours: m.durationHours || 1 });
  const d = new Date(`${m.date}T12:00:00`);
  return (
    <li className={`rounded-xl border p-3 ${first ? 'border-zinc-600 bg-white/[0.03]' : 'border-zinc-800'}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 shrink-0 overflow-hidden rounded-lg border border-zinc-700 text-center">
          <p className="bg-zinc-800 py-0.5 text-[9px] font-bold uppercase text-zinc-400">{d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</p>
          <p className="py-0.5 text-base font-semibold text-zinc-100">{d.getDate()}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-100 truncate">{m.title}</p>
          <p className="text-[11px] text-zinc-400 capitalize">{d.toLocaleDateString('es-AR', { weekday: 'long' })}{m.time ? ` · ${m.time} hs` : ' · sin hora'}{m.durationHours ? ` · ${m.durationHours === 0.5 ? '30 min' : `${m.durationHours} h`}` : ''}</p>
          <InviteLine m={m} clientEmails={clientEmails} onInvite={onUpdateMeeting ? () => onUpdateMeeting(m.id, { invitados: clientEmails }) : undefined} />
          <p className="mt-0.5 text-[10px]">
            {first && <span className="mr-2 text-sky-300">La ve el cliente</span>}
            {m.googleEventId ? <span className="text-emerald-400">En tu Google Calendar</span>
              : connected ? <span className="text-zinc-500">Pasando a Calendar…</span>
              : <a href={googleCalendarLink(m)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-sky-300">Guardar en Calendar <ExternalLink className="w-3 h-3" /></a>}
          </p>
        </div>
      </div>
      {editing ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <input className={`${field} flex-1 min-w-[9rem]`} type="date" aria-label="Fecha" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <input className={`${field} w-24`} type="time" aria-label="Hora" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          <select className={`${field} w-24`} aria-label="Duración" value={f.durationHours} onChange={(e) => setF({ ...f, durationHours: Number(e.target.value) })}>
            <option value={0.5}>30 min</option><option value={1}>1 h</option><option value={1.5}>1 h 30</option><option value={2}>2 h</option>
          </select>
          <button type="button" onClick={() => { onUpdateMeeting?.(m.id, { date: f.date, ...(f.time ? { time: f.time } : {}), durationHours: f.durationHours }); setEditing(false); }} className="btn-solid-primary px-3 py-1.5 text-xs">Guardar</button>
          <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-zinc-400">Cancelar</button>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {onUpdateMeeting && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700"><Pencil className="w-3 h-3" />Mover</button>}
          {onToggleMeeting && <button type="button" onClick={() => { onToggleMeeting(m.id); onWritingSummary(true); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-300"><Check className="w-3 h-3" />Ya la hicimos</button>}
          {onDeleteMeeting && <button type="button" aria-label={`Borrar ${m.title}`} onClick={() => window.confirm(`¿Borrar la reunión "${m.title}"? También se borra de tu Google Calendar.`) && onDeleteMeeting(m.id)} className="ml-auto text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      )}
    </li>
  );
}

/** Si el cliente está invitado en Google Calendar, si falló, o el botón para invitarlo */
function InviteLine({ m, clientEmails, onInvite }: { m: AgendaMeeting; clientEmails: string[]; onInvite?: () => void }) {
  const invitados = m.invitados || [];
  const key = [...invitados].map((e) => e.toLowerCase()).sort().join(',');
  if (!invitados.length) {
    if (!clientEmails.length || !onInvite) return null;
    return (
      <button type="button" onClick={onInvite} className="mt-1 inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
        <UserPlus className="w-3 h-3" />Invitar al cliente
      </button>
    );
  }
  if (m.googleInviteError) return <p className="mt-0.5 text-[10px] text-amber-300">{m.googleInviteError}</p>;
  const sent = m.googleInviteHash === key;
  return <p className={`mt-0.5 text-[10px] ${sent ? 'text-emerald-400' : 'text-zinc-500'}`}>{sent ? `Invitación enviada a ${invitados.join(', ')}` : `Invitando a ${invitados.join(', ')}…`}</p>;
}
