import React, { useState } from 'react';
import { CalendarPlus, Check, ChevronDown, ListChecks, Package, Play } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import { PRESENCIA_HITOS, hitosCompletados } from '../portal/model';
import { SERVICIOS, TEMA_FASE_LABEL, faseDelTema, kitDelTema, temasDelAlcance, type Servicio, type TemaFase, type TemaId, type TemaPlantilla } from '../portal/presencia';
import { conHistorial } from '../portal/historial';
import { republishIfPublished } from '../portal/store';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

const FASE_STYLE: Record<TemaFase, string> = {
  sin_empezar: 'bg-zinc-800 text-zinc-400',
  en_curso: 'bg-sky-500/15 text-sky-300',
  esperando: 'bg-amber-400/15 text-amber-300',
  completo: 'bg-emerald-500/15 text-emerald-300',
};
const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

/**
 * PLAN DE PRESENCIA: los temas del método agrupados por hito, según lo que contrató.
 * "Empezar tema" carga sus tareas (ocultas) y entregas (por preparar); el checklist dice
 * cuándo está completo, y con todos los temas de un hito completos se confirma el hito.
 */
export const PafPlanSection: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAgendar: (tema: TemaPlantilla) => void;
  onVer: (section: 'tareas' | 'entregas') => void;
  onConfirmarHito: (hito: number, evidencia: string) => void;
}> = ({ project, meetings, onUpdateProject, onAgendar, onVer, onConfirmarHito }) => {
  const alcance = project.pafAlcance || [];
  const temas = temasDelAlcance(alcance);
  const estados = project.pafTemas || {};
  const tareas = project.pafTareas || [];
  const entregas = project.pafEntregas || [];
  const hechos = hitosCompletados(project.pafHitos);
  const [abierto, setAbierto] = useState<TemaId | null>(() => temas.find((t) => faseDelTema(t, estados[t.id], tareas) !== 'completo')?.id || null);
  const [error, setError] = useState('');

  const save = (updates: Partial<Project>) => {
    setError('');
    onUpdateProject(project.id, updates);
    republishIfPublished({ ...project, ...updates }, meetings).catch((e: Error) => setError(e.message));
  };

  const toggleServicio = (s: Servicio) => {
    const next = alcance.includes(s) ? alcance.filter((x) => x !== s) : [...alcance, s];
    onUpdateProject(project.id, { pafAlcance: next });
  };

  const empezar = (t: TemaPlantilla) => {
    hapticFeedback.light();
    const kit = kitDelTema(t, { tareas, entregas }, newItemId);
    save({
      pafTemas: { ...estados, [t.id]: { ...estados[t.id], empezado: getTodayString() } },
      pafTareas: [...tareas, ...kit.tareas],
      pafEntregas: [...entregas, ...kit.entregas],
      ...conHistorial(project, `Empezó el tema ${t.titulo}`),
    });
  };

  const toggleCheck = (t: TemaPlantilla, i: number) => {
    const checks = [...(estados[t.id]?.checks || t.completoCuando.map(() => false))];
    checks[i] = !checks[i];
    const completo = t.completoCuando.every((_, j) => checks[j]);
    const antes = faseDelTema(t, estados[t.id], tareas) === 'completo';
    onUpdateProject(project.id, {
      pafTemas: { ...estados, [t.id]: { empezado: estados[t.id]?.empezado || getTodayString(), checks } },
      ...(completo && !antes ? conHistorial(project, `Tema completo: ${t.titulo}`) : {}),
    });
    if (completo && !antes) hapticFeedback.success();
  };

  const completos = temas.filter((t) => faseDelTema(t, estados[t.id], tareas) === 'completo').length;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-xs font-bold text-zinc-100">Qué contrató</h3>
            <p className="text-[11px] text-zinc-500">Lo que no contrató no aparece en su plan ni cuenta para el avance.</p>
          </div>
          <span className="text-[11px] text-zinc-400">{completos} de {temas.length} temas completos</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-zinc-700 bg-white/[0.04] px-3 py-1 text-[11px] text-zinc-300">Base: arranque, foco, mensaje y cierre</span>
          {SERVICIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => toggleServicio(s.id)} aria-pressed={alcance.includes(s.id)} title={s.hint}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${alcance.includes(s.id) ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
              {alcance.includes(s.id) ? '✓ ' : '+ '}{s.label}
            </button>
          ))}
        </div>
      </section>

      {PRESENCIA_HITOS.map((titulo, i) => {
        const n = i + 1;
        const delHito = temas.filter((t) => t.hito === n);
        if (!delHito.length) return null;
        const listo = delHito.every((t) => faseDelTema(t, estados[t.id], tareas) === 'completo');
        const confirmado = hechos.includes(n);
        return (
          <section key={titulo} className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-100">
              <span className={`flex w-5 h-5 items-center justify-center rounded-full text-[10px] ${confirmado ? 'bg-emerald-500 text-zinc-950' : 'border border-zinc-600 text-zinc-300'}`}>{confirmado ? <Check className="w-3 h-3" /> : n}</span>
              Hito {n} · {titulo}
              {confirmado && <span className="font-normal text-emerald-400">confirmado</span>}
            </h3>
            {listo && !confirmado && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
                <p className="flex-1 text-[11px] text-zinc-200">Todos los temas de este hito están completos. ¿Lo confirmás? Se le marca como hecho en su portal.</p>
                <button type="button" onClick={() => onConfirmarHito(n, `Temas completos: ${delHito.map((t) => t.titulo).join(', ')}`)} className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">Confirmar hito {n}</button>
              </div>
            )}
            <ul className="space-y-1.5">
              {delHito.map((t) => (
                <TemaCard key={t.id} t={t} project={project} meetings={meetings} abierto={abierto === t.id} onToggle={() => setAbierto((a) => (a === t.id ? null : t.id))}
                  onEmpezar={() => empezar(t)} onCheck={(i) => toggleCheck(t, i)} onAgendar={() => onAgendar(t)} onVer={onVer} />
              ))}
            </ul>
          </section>
        );
      })}

      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      <Historial items={project.pafHistorial || []} />
    </div>
  );
};

function TemaCard({ t, project, meetings, abierto, onToggle, onEmpezar, onCheck, onAgendar, onVer }: {
  t: TemaPlantilla; project: Project; meetings: AgendaMeeting[]; abierto: boolean; onToggle: () => void;
  onEmpezar: () => void; onCheck: (i: number) => void; onAgendar: () => void; onVer: (s: 'tareas' | 'entregas') => void;
}) {
  const estado = project.pafTemas?.[t.id];
  const tareas = (project.pafTareas || []).filter((x) => x.tema === t.id);
  const entregas = (project.pafEntregas || []).filter((x) => x.tema === t.id);
  const fase = faseDelTema(t, estado, project.pafTareas || []);
  const checks = estado?.checks || [];
  const hechos = t.completoCuando.filter((_, i) => checks[i]).length;
  const reunion = meetings.filter((m) => m.projectId === project.id && m.tema === t.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const tareasTxt = tareas.length
    ? `${tareas.filter((x) => x.estado === 'aprobada').length} completas · ${tareas.filter((x) => x.estado === 'habilitada' || x.estado === 'enviada').length} en marcha · ${tareas.filter((x) => x.estado === 'borrador').length} por preparar`
    : 'sin tareas cargadas';
  return (
    <li className={`rounded-xl border ${fase === 'completo' ? 'border-emerald-500/20' : abierto ? 'border-zinc-600' : 'border-zinc-800'}`}>
      <button type="button" onClick={onToggle} aria-expanded={abierto} className="flex w-full items-center gap-2 p-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-zinc-100">{t.titulo}</span>
          <span className="block text-[10px] text-zinc-500">{hechos} de {t.completoCuando.length} del checklist{estado?.empezado ? ` · desde el ${ddmm(estado.empezado)}` : ''}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${FASE_STYLE[fase]}`}>{TEMA_FASE_LABEL[fase]}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-zinc-800 p-3">
          <p className="text-[11px] text-zinc-400">{t.objetivo}</p>

          {!estado?.empezado && fase !== 'completo' && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-2.5 space-y-1.5">
              <p className="text-[11px] text-zinc-300">Al empezarlo se cargan {t.tareas.length ? `${t.tareas.length} ${t.tareas.length === 1 ? 'tarea' : 'tareas'} (ocultas)` : 'sus pasos'}{t.entregas.length ? ` y ${t.entregas.length === 1 ? 'su entrega' : 'sus entregas'} (por preparar)` : ''}. El cliente no ve nada hasta que lo habilitás.</p>
              <button type="button" onClick={onEmpezar} className="inline-flex items-center gap-1 btn-solid-primary px-2.5 py-1 text-[11px]"><Play className="w-3 h-3" />Empezar tema</button>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-zinc-300">Está completo cuando</p>
            <ul className="mt-1 space-y-1">
              {t.completoCuando.map((c, i) => (
                <li key={c}><label className="flex items-start gap-2 text-[11px] text-zinc-300"><input type="checkbox" className="mt-0.5" checked={!!checks[i]} onChange={() => onCheck(i)} /><span className={checks[i] ? 'text-zinc-500 line-through' : ''}>{c}</span></label></li>
              ))}
            </ul>
          </div>

          <div className="grid gap-1.5 text-[11px] sm:grid-cols-3">
            <button type="button" onClick={() => onVer('tareas')} className="flex items-start gap-1.5 rounded-lg bg-zinc-900 p-2 text-left text-zinc-300 hover:bg-zinc-800">
              <ListChecks className="mt-0.5 w-3.5 h-3.5 shrink-0 text-zinc-500" /><span><span className="block font-semibold text-zinc-200">Tareas</span>{tareasTxt}</span>
            </button>
            <button type="button" onClick={() => onVer('entregas')} className="flex items-start gap-1.5 rounded-lg bg-zinc-900 p-2 text-left text-zinc-300 hover:bg-zinc-800">
              <Package className="mt-0.5 w-3.5 h-3.5 shrink-0 text-zinc-500" /><span><span className="block font-semibold text-zinc-200">Entregas</span>{entregas.length ? entregas.map((e) => `${e.titulo}${e.version ? ` ${e.version}` : ''}: ${e.estado === 'aprobada' ? 'aprobada' : e.publicada ? 'para revisar' : 'por preparar'}`).join(' · ') : t.entregas.length ? 'sin cargar' : 'no tiene'}</span>
            </button>
            <div className="flex items-start gap-1.5 rounded-lg bg-zinc-900 p-2 text-zinc-300">
              <CalendarPlus className="mt-0.5 w-3.5 h-3.5 shrink-0 text-zinc-500" />
              <span className="min-w-0">
                <span className="block font-semibold text-zinc-200">{t.reunion?.titulo || 'Sin reunión fija'}</span>
                {reunion ? (reunion.completed ? `Hecha el ${ddmm(reunion.date)}` : reunion.proposed ? 'Propuesta, sin hora' : `${ddmm(reunion.date)}${reunion.time ? ` · ${reunion.time}` : ''}`)
                  : t.reunion ? <button type="button" onClick={onAgendar} className="font-bold text-sky-300">Agendar</button> : 'Se confirma en la reunión habitual o por mensaje'}
              </span>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Historial({ items }: { items: { fecha: string; texto: string }[] }) {
  const [todos, setTodos] = useState(false);
  if (!items.length) return null;
  return (
    <section className="rounded-xl border border-zinc-800 p-3 space-y-1.5">
      <h3 className="text-xs font-bold text-zinc-100">Historial <span className="font-normal text-zinc-500">· solo para vos</span></h3>
      <ul className="space-y-1">
        {(todos ? items : items.slice(0, 8)).map((h, i) => (
          <li key={i} className="flex gap-2 text-[11px]"><span className="w-20 shrink-0 tabular-nums text-zinc-500">{new Date(h.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span><span className="text-zinc-300">{h.texto}</span></li>
        ))}
      </ul>
      {items.length > 8 && <button type="button" onClick={() => setTodos((v) => !v)} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-200">{todos ? 'Ver menos' : `Ver los ${items.length}`}</button>}
    </section>
  );
}
