import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, CalendarDays, PlayCircle, GraduationCap, Loader2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { StudentPortalSnapshot, subscribeStudentPortal } from '../utils/studentPortal';
import { formatDisplayDate } from '../utils/projectTimeline';

interface Props {
  token: string;
}

// Página pública de solo lectura para el alumno PAF (/alumno/{token}).
// Se renderiza sin la app completa ni el PIN: solo lee su propia "foto".
export const StudentPortalView: React.FC<Props> = ({ token }) => {
  const [data, setData] = useState<StudentPortalSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    document.title = 'Mi avance · Método PAF';
    if (!/^[a-f0-9]{24,64}$/.test(token)) {
      setState('missing');
      return;
    }
    return subscribeStudentPortal(
      token,
      (snap) => {
        setData(snap);
        setState(snap ? 'ready' : 'missing');
      },
      () => setState('error')
    );
  }, [token]);

  if (state === 'loading') {
    return (
      <Shell>
        <div className="flex justify-center py-24 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (state !== 'ready' || !data) {
    return (
      <Shell>
        <div className="text-center py-20 space-y-2">
          <p className="text-zinc-200 font-semibold">
            {state === 'error' ? 'No pudimos cargar tu avance' : 'Este link no está disponible'}
          </p>
          <p className="text-sm text-zinc-500">
            {state === 'error' ? 'Revisá tu conexión y volvé a intentar.' : 'Pedile a tu consultor un link nuevo.'}
          </p>
        </div>
      </Shell>
    );
  }

  const hoursPct = data.hoursTotal > 0 ? Math.min(100, Math.round((data.hoursDone / data.hoursTotal) * 100)) : 0;
  const deliverablesDone = data.deliverables.filter((d) => d.done).length;
  const weekPct = data.currentWeek ? Math.round((data.currentWeek / data.totalWeeks) * 100) : 0;

  return (
    <Shell>
      {/* Encabezado */}
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">{data.programName}</p>
        <h1 className="text-2xl font-bold text-zinc-50">{data.studentName}</h1>
        {(data.startDate || data.endDate) && (
          <p className="text-sm text-zinc-400">
            {data.startDate && <>Inicio {formatDisplayDate(data.startDate, 'medium')}</>}
            {data.startDate && data.endDate && ' · '}
            {data.endDate && <>Cierre {formatDisplayDate(data.endDate, 'medium')}</>}
          </p>
        )}
      </header>

      {data.graduated && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <GraduationCap className="w-6 h-6 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-200 font-medium">¡Completaste el programa! Felicitaciones.</p>
        </div>
      )}

      {/* Etapas */}
      <Card title="Tu etapa">
        {data.currentWeek && !data.graduated && (
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Semana {data.currentWeek} de {data.totalWeeks}</span>
              <span>{weekPct}%</span>
            </div>
            <Bar pct={weekPct} />
          </div>
        )}
        <ol className="space-y-2.5">
          {data.stages.map((s) => (
            <li key={s.name} className="flex items-center gap-3">
              {s.status === 'done' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : s.status === 'current' ? (
                <span className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                </span>
              ) : (
                <Circle className="w-5 h-5 text-zinc-700 shrink-0" />
              )}
              <span
                className={`text-sm ${
                  s.status === 'current' ? 'text-zinc-50 font-semibold' : s.status === 'done' ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                {s.name}
              </span>
              {s.status === 'current' && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-amber-400">Ahora</span>
              )}
            </li>
          ))}
        </ol>
      </Card>

      {/* Entregables */}
      {data.deliverables.length > 0 && (
        <Card title={`Para pasar de etapa · ${deliverablesDone}/${data.deliverables.length}`}>
          <ul className="space-y-2.5">
            {data.deliverables.map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                {d.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-px" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-600 shrink-0 mt-px" />
                )}
                <span className={`text-sm leading-snug ${d.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{d.text}</span>
              </li>
            ))}
          </ul>
          {!data.graduated && deliverablesDone === data.deliverables.length && (
            <p className="mt-3 text-xs font-semibold text-emerald-400">¡Completaste todo! Lo vemos en la próxima sesión para pasar de etapa.</p>
          )}
        </Card>
      )}

      {/* Horas */}
      <Card title="Horas de consultoría 1:1">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-zinc-50 tabular-nums">{data.hoursRemaining}</span>
          <span className="text-sm text-zinc-400">hs disponibles de {data.hoursTotal}</span>
        </div>
        <Bar pct={hoursPct} />
        <p className="text-xs text-zinc-500 mt-2">Usaste {data.hoursDone} hs ({hoursPct}%)</p>
      </Card>

      {/* Próxima sesión */}
      {data.nextSession && (
        <Card title="Próxima sesión">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-sm text-zinc-100 font-medium">
              {formatDisplayDate(data.nextSession.date, 'medium')}
              {data.nextSession.time && ` · ${data.nextSession.time} hs`}
            </span>
          </div>
        </Card>
      )}

      {/* Sesiones */}
      {data.sessions.length > 0 && (
        <Card title="Sesiones realizadas">
          <ul className="divide-y divide-zinc-800">
            {data.sessions.map((s, i) => (
              <li key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                <Clock className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200">
                    {formatDisplayDate(s.date, 'medium')}
                    {s.hours ? <span className="text-zinc-500"> · {s.hours} h</span> : null}
                  </p>
                  {s.topics && <p className="text-xs text-zinc-400 mt-0.5 break-words">{s.topics}</p>}
                </div>
                {s.recordingUrl && /^https?:\/\//.test(s.recordingUrl) && (
                  <a
                    href={s.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Grabación
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-[11px] text-zinc-600 pt-2">
        Actualizado {new Date(data.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} · se actualiza solo
      </p>
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#0B0F17] text-zinc-100">
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <BrandLogo size="sm" className="mb-2" />
      {children}
    </div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{title}</h2>
    {children}
  </section>
);

const Bar: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
  </div>
);
