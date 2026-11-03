import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ExternalLink } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { getAuthHeaders } from '../utils/authAccess';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

const field = 'rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const input = `w-full ${field}`;

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
}> = ({ project, meetings, onAddMeeting, suggestedTitle }) => {
  const [form, setForm] = useState({ title: `Reunión PAF · ${project.clientName}`, date: getTodayString(), time: '11:00', durationHours: 1, notes: '' });
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!suggestedTitle) return;
    setForm((f) => ({ ...f, title: `${suggestedTitle} · ${project.clientName}` }));
    titleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    titleRef.current?.focus();
  }, [suggestedTitle, project.clientName]);
  const [calendarSync, setCalendarSync] = useState<boolean | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/automation/status', { headers: await getAuthHeaders() });
        const data = res.ok ? await res.json() : null;
        if (alive) setCalendarSync(Boolean(data?.calendar));
      } catch {
        if (alive) setCalendarSync(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
      completed: false,
      projectId: project.id,
      projectName: project.clientName,
    };
    onAddMeeting(meeting);
    if (calendarSync) {
      setNotice('Agendada. Aparece en tu Google Calendar en unos minutos. La invitación al estudio la mandás vos desde ahí.');
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
        {calendarSync !== null && <span className="text-[10px] text-zinc-500">{calendarSync ? 'Calendar sincronizado' : 'Se abre Google Calendar'}</span>}
      </div>

      {upcoming.length > 0 && (
        <ul className="space-y-1">
          {upcoming.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[11px] text-zinc-300">
              <span className="flex-1 min-w-0 truncate">{m.date}{m.time ? ` · ${m.time}` : ''} · {m.title}</span>
              {!calendarSync && !m.googleEventId && (
                <a href={googleCalendarLink(m)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 font-bold">Calendar <ExternalLink className="w-3 h-3" /></a>
              )}
            </li>
          ))}
        </ul>
      )}

      <input ref={titleRef} className={input} value={form.title} aria-label="Título" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <div className="flex flex-wrap gap-1.5">
        <input className={`${field} flex-1 min-w-[9.5rem]`} type="date" aria-label="Fecha" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input className={`${field} w-28`} type="time" aria-label="Hora" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <select className={`${field} w-24`} aria-label="Duración" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}>
          <option value={0.5}>30 min</option><option value={1}>1 h</option><option value={1.5}>1 h 30</option><option value={2}>2 h</option>
        </select>
      </div>
      <input className={input} value={form.notes} placeholder="Temas (opcional)" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button type="button" onClick={schedule} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 text-zinc-950 px-3 py-1.5 text-xs font-bold">
        <CalendarPlus className="w-3.5 h-3.5" /> Agendar
      </button>
      {notice && <p role="status" className="text-[11px] text-emerald-300">{notice}</p>}
    </div>
  );
};
