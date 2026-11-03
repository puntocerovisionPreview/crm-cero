import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ExternalLink } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { getCalendarStatus } from '../utils/calendarSyncClient';
import { useGoogleCalendarBrowser } from '../utils/googleCalendarBrowser';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

const field = 'rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const input = `w-full ${field}`;

/** Correos del cliente para invitarlo: los que entran a su portal o, si no hay, el de la ficha */
export function clientInviteEmails(project: Pick<Project, 'pafPortal' | 'clientEmail'>): string[] {
  const list = project.pafPortal?.emails?.length ? project.pafPortal.emails : project.clientEmail ? [project.clientEmail] : [];
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
}

/** Tipos de reunión frecuentes: ponen el título y la duración */
const MEETING_TYPES = [
  { label: 'Reunión de arranque', horas: 1.5 },
  { label: 'Seguimiento', horas: 1 },
  { label: 'Revisión de entrega', horas: 1 },
  { label: 'Llamada corta', horas: 0.5 },
  { label: 'Cierre de etapa', horas: 1 },
];

/** Evento prellenado en Google Calendar (sin invitados: la invitación la mandás vos) */
export function googleCalendarLink(m: { title: string; date: string; time?: string; durationHours?: number; notes?: string }): string {
  const start = new Date(`${m.date}T${m.time || '11:00'}:00`);
  const end = new Date(start.getTime() + (m.durationHours || 1) * 3_600_000);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: m.title, dates: `${fmt(start)}/${fmt(end)}`, ctz: 'America/Argentina/Buenos_Aires' });
  if (m.notes) q.set('details', m.notes);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/**
 * En la ficha PAF: agendar una reunión con fecha y hora.
 * Queda en la agenda del CRM (y en el portal del estudio como próxima reunión).
 * Si la sincronización con Google Calendar está activa, aparece sola en tu Calendar;
 * si no, se abre Google Calendar con el evento listo para guardar.
 * Nunca invita al estudio: la invitación la mandás vos desde Calendar.
 */
export const PafReunionCard: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  /** Título que propone la plantilla de la etapa (ej. "Reunión de arranque") */
  suggestedTitle?: string;
  /** La lista de próximas ya se muestra afuera */
  hideUpcoming?: boolean;
  /** Si ya se sabe si Calendar está conectado (evita preguntarle otra vez al servidor) */
  calendarConnected?: boolean;
  onCancel?: () => void;
}> = ({ project, meetings, onAddMeeting, suggestedTitle, hideUpcoming, calendarConnected, onCancel }) => {
  const [form, setForm] = useState({ title: `Reunión PAF · ${project.clientName}`, date: getTodayString(), time: '11:00', durationHours: 1, notes: '', objetivo: '', preparar: '', conCM: false });
  // A quién invitar: los correos que entran a su portal (o el del cliente)
  const clientEmails = clientInviteEmails(project);
  const [invitar, setInvitar] = useState(clientEmails.length > 0);
  const titleRef = useRef<HTMLInputElement>(null);
  const browserCal = useGoogleCalendarBrowser();
  useEffect(() => {
    if (!suggestedTitle) return;
    setForm((f) => ({ ...f, title: `${suggestedTitle} · ${project.clientName}` }));
    titleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    titleRef.current?.focus();
  }, [suggestedTitle, project.clientName]);
  const [calendarSync, setCalendarSync] = useState<boolean | null>(calendarConnected ?? null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (calendarConnected !== undefined) { setCalendarSync(calendarConnected); return; }
    let alive = true;
    getCalendarStatus().then((st) => { if (alive) setCalendarSync(st.connected); });
    return () => { alive = false; };
  }, [calendarConnected]);

  const effectiveSync = Boolean(calendarSync || browserCal.connected || browserCal.tokenExpired);

  const upcoming = meetings
    .filter((m) => m.projectId === project.id && !m.completed && m.date >= getTodayString())
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 3);

  const schedule = () => {
    if (!form.date || !form.time || !form.title.trim()) { setNotice('Completá título, fecha y hora.'); return; }
    hapticFeedback.light();
    const meeting = {
      title: form.title.trim(),
      date: form.date,
      time: form.time,
      durationHours: form.durationHours,
      notes: form.notes.trim() || undefined,
      ...(form.objetivo.trim() ? { objetivo: form.objetivo.trim() } : {}),
      ...(form.preparar.trim() ? { preparar: form.preparar.trim() } : {}),
      ...(form.conCM ? { conCM: true } : {}),
      completed: false,
      projectId: project.id,
      projectName: project.clientName,
      ...(invitar && clientEmails.length ? { invitados: clientEmails } : {}),
    };
    onAddMeeting(meeting);
    if (effectiveSync) {
      setNotice(invitar && clientEmails.length ? `Agendada. En segundos aparece en tu Calendar y Google le manda la invitación a ${clientEmails.join(', ')}.` : 'Agendada. Aparece en tu Google Calendar en segundos.');
    } else {
      // Se abre en el mismo clic para que el navegador no lo bloquee
      window.open(googleCalendarLink(meeting), '_blank', 'noopener');
      setNotice('Agendada en el CRM. Guardá el evento en la pestaña de Google Calendar que se abrió y, si querés, invitá al estudio desde ahí.');
    }
  };

  return (
    <div className="space-y-2.5 pt-3 border-t border-zinc-800">
      <div className="flex items-center gap-2">
        <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
        <h3 className="text-xs font-bold text-zinc-100 flex-1">Agendar reunión</h3>
        {(calendarSync !== null || browserCal.connected) && <span className="text-[10px] text-zinc-500">{effectiveSync ? 'Calendar sincronizado' : 'Se abre Google Calendar'}</span>}
      </div>

      {!hideUpcoming && upcoming.length > 0 && (
        <ul className="space-y-1">
          {upcoming.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[11px] text-zinc-300">
              <span className="flex-1 min-w-0 truncate">{m.date}{m.time ? ` · ${m.time}` : ''} · {m.title}</span>
              {!effectiveSync && !m.googleEventId && (
                <a href={googleCalendarLink(m)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 font-bold">Calendar <ExternalLink className="w-3 h-3" /></a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5" aria-label="Tipo de reunión">
        {MEETING_TYPES.map((t) => (
          <button key={t.label} type="button" onClick={() => setForm((f) => ({ ...f, title: `${t.label} · ${project.clientName}`, durationHours: t.horas }))}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${form.title.startsWith(t.label) ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>{t.label}</button>
        ))}
      </div>
      <input ref={titleRef} className={input} value={form.title} aria-label="Título" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <div className="flex flex-wrap gap-1.5">
        <input className={`${field} flex-1 min-w-[9.5rem]`} type="date" aria-label="Fecha" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input className={`${field} w-28`} type="time" aria-label="Hora" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <select className={`${field} w-24`} aria-label="Duración" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}>
          <option value={0.5}>30 min</option><option value={1}>1 h</option><option value={1.5}>1 h 30</option><option value={2}>2 h</option>
        </select>
      </div>
      <input className={input} value={form.objetivo} placeholder="Objetivo (lo ve el cliente). Ej: revisar la propuesta de mensaje" onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
      <input className={input} value={form.preparar} placeholder="Qué traer o pensar (lo ve el cliente). Ej: 3 proyectos que te representen" onChange={(e) => setForm({ ...form, preparar: e.target.value })} />
      <input className={input} value={form.notes} placeholder="Notas para vos (no las ve el cliente)" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <label className="flex items-center gap-2 text-[11px] text-zinc-400"><input type="checkbox" checked={form.conCM} onChange={(e) => setForm({ ...form, conCM: e.target.checked })} />Se suma la community manager</label>
      {clientEmails.length > 0 ? (
        <label className="flex items-start gap-2 rounded-lg border border-zinc-800 p-2 text-[11px] text-zinc-300">
          <input type="checkbox" className="mt-0.5" checked={invitar} onChange={(e) => setInvitar(e.target.checked)} />
          <span>Invitar al cliente: Google le manda la invitación desde tu Gmail a <span className="text-zinc-100">{clientEmails.join(', ')}</span>, y le avisa si la movés o la cancelás.</span>
        </label>
      ) : <p className="text-[11px] text-zinc-500">Para invitar al cliente, cargá su correo en Ajustes → Quién puede entrar.</p>}
      <button type="button" onClick={schedule} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 text-zinc-950 px-3 py-1.5 text-xs font-bold">
        <CalendarPlus className="w-3.5 h-3.5" /> Agendar
      </button>
      {onCancel && <button type="button" onClick={onCancel} className="ml-2 text-[11px] text-zinc-400 hover:text-zinc-200">Cancelar</button>}
      {notice && <p role="status" className="text-[11px] text-emerald-300">{notice}</p>}
    </div>
  );
};
