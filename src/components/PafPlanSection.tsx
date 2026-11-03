import React, { useState } from 'react';
import { CalendarPlus, Check, ChevronDown, ListChecks, Package, Play } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import { hitosCompletados } from '../portal/model';
import { ETAPAS, ETAPA_HITOS, SERVICIOS, TEMA_FASE_LABEL, type Etapa, faseDelTema, kitDelTema, temasDelAlcance, type Servicio, type TemaFase, type TemaId, type TemaPlantilla } from '../portal/presencia';
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
 * PLAN DEL PROGRAMA: las etapas que contrató (Presencia, Adquisición, Conversión), cada una con
 * sus temas agrupados por hito. "Empezar tema" carga sus tareas (ocultas) y entregas (por
 * preparar); el checklist dice cuándo está completo y con todos los temas de un hito se confirma.
 * Una etapa nueva empieza solo cuando la activás vos (nunca por fecha ni por pago).
 */
export const PafPlanSection: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAgendar: (tema: TemaPlantilla) => void;
  onVer: (section: 'tareas' | 'entregas') => void;
  onConfirmarHito: (hito: number, evidencia: string, etapa: Etapa) => void;
  onActivarEtapa: (etapa: Etapa) => void;
}> = ({ project, meetings, onUpdateProject, onAgendar, onVer, onConfirmarHito, onActivarEtapa }) => {
  const actual: Etapa = project.pafEtapa || 'presencia';
  const contratadas: Etapa[] = (['presencia', 'adquisicion', 'conversion'] as Etapa[]).filter((e) => e === 'presencia' || e === actual || (project.pafEtapasContratadas || []).includes(e));
  const [vista, setVista] = useState<Etapa>(actual);
  const alcance = project.pafAlcance || [];
  const temas = temasDelAlcance(alcance, vista);
  const estados = project.pafTemas || {};
  const tareas = project.pafTareas || [];
  const entregas = project.pafEntregas || [];
  const hechos = hitosCompletados(project.pafHitos, vista);
  const hitos = ETAPA_HITOS[vista];
  const infoVista = ETAPAS.find((x) => x.id === vista)!;
  const [abierto, setAbierto] = useState<TemaId | null>(() => temasDelAlcance(alcance, actual).find((t) => faseDelTema(t, estados[t.id], tareas) !== 'completo')?.id || null);
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
  const toggleEtapa = (e: Etapa) => {
    const cont = project.pafEtapasContratadas || [];
    save({ pafEtapasContratadas: cont.includes(e) ? cont.filter((x) => x !== e) : [...cont, e] });
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
  const siguiente = contratadas[contratadas.indexOf(actual) + 1];

  return (
    <div className="space-y-4">
      <ClientTimeline project={project} meetings={meetings} />

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 space-y-3">
        <div>
          <h3 className="text-xs font-bold text-zinc-100">Qué contrató</h3>
          <p className="text-[11px] text-zinc-500">Lo que no contrató no aparece en su plan ni en su portal.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-zinc-700 bg-white/[0.04] px-3 py-1 text-[11px] text-zinc-300">Presencia</span>
          {(['adquisicion', 'conversion'] as Etapa[]).map((e) => {
            const on = (project.pafEtapasContratadas || []).includes(e) || actual === e;
            return (
              <button key={e} type="button" onClick={() => actual !== e && toggleEtapa(e)} aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${on ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                {on ? '✓ ' : '+ '}{ETAPAS.find((x) => x.id === e)!.label}<span className="ml-1 font-normal opacity-60">(borrador)</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SERVICIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => toggleServicio(s.id)} aria-pressed={alcance.includes(s.id)} title={s.hint}
              className={`rounded-full border px-3 py-1 text-[11px] transition ${alcance.includes(s.id) ? 'border-zinc-400 bg-white/[0.08] text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
              {alcance.includes(s.id) ? '✓ ' : '+ '}{s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Etapas: la actual marcada, y la que viene para activar cuando corresponda */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Etapas">
        {contratadas.map((e) => {
          const info = ETAPAS.find((x) => x.id === e)!;
          return (
            <button key={e} type="button" role="tab" aria-selected={vista === e} onClick={() => setVista(e)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${vista === e ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>
              {info.label}{e === actual && <span className={`ml-1.5 text-[10px] font-normal ${vista === e ? 'text-zinc-600' : 'text-sky-300'}`}>· en curso</span>}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-zinc-400">{completos} de {temas.length} temas completos</span>
      </div>

      {infoVista.borrador && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2 text-[11px] text-amber-200">Etapa en borrador: sale de los módulos “por desarrollar”. Revisá cada tarea y entrega antes de habilitarla.</p>
      )}
      {vista !== actual && contratadas.indexOf(vista) > contratadas.indexOf(actual) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 p-2.5">
          <p className="flex-1 text-[11px] text-zinc-300">{infoVista.label} todavía no empezó. Empieza cuando vos la activás: su portal pasa a mostrar esta etapa.</p>
          {vista === siguiente && <button type="button" onClick={() => window.confirm(`¿Pasar a ${infoVista.label}? El cliente empieza a ver esta etapa en su portal.`) && onActivarEtapa(vista)} className="btn-solid-primary px-2.5 py-1 text-[11px]">Activar {infoVista.label}</button>}
        </div>
      )}

      {hitos.map((h, i) => {
        const n = i + 1;
        const delHito = temas.filter((t) => t.hito === n);
        if (!delHito.length) return null;
        const listo = delHito.every((t) => faseDelTema(t, estados[t.id], tareas) === 'completo');
        const confirmado = hechos.includes(n);
        return (
          <section key={h.titulo} className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-100">
              <span className={`flex w-5 h-5 items-center justify-center rounded-full text-[10px] ${confirmado ? 'bg-emerald-500 text-zinc-950' : 'border border-zinc-600 text-zinc-300'}`}>{confirmado ? <Check className="w-3 h-3" /> : n}</span>
              Hito {n} · {h.titulo}
              {confirmado && <span className="font-normal text-emerald-400">confirmado</span>}
            </h3>
            {listo && !confirmado && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
                <p className="flex-1 text-[11px] text-zinc-200">Todos los temas de este hito están completos. ¿Lo confirmás? Se le marca como hecho en su portal.</p>
                <button type="button" onClick={() => onConfirmarHito(n, `Temas completos: ${delHito.map((t) => t.titulo).join(', ')}`, vista)} className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">Confirmar hito {n}</button>
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

      {vista === actual && siguiente && hechos.length === hitos.length && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/[0.05] p-2.5">
          <p className="flex-1 text-[11px] text-zinc-200">Completaste {ETAPAS.find((x) => x.id === actual)!.label}. Cuando estén listos, pasá a {ETAPAS.find((x) => x.id === siguiente)!.label}.</p>
          <button type="button" onClick={() => window.confirm(`¿Pasar a ${ETAPAS.find((x) => x.id === siguiente)!.label}?`) && onActivarEtapa(siguiente)} className="btn-solid-primary px-2.5 py-1 text-[11px]">Activar {ETAPAS.find((x) => x.id === siguiente)!.label}</button>
        </div>
      )}

      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      <Historial items={project.pafHistorial || []} />
    </div>
  );
};

/**
 * LÍNEA DE TIEMPO DEL CLIENTE: un casillero por mes desde que empezó, con la etapa de cada mes,
 * las reuniones (hechas y agendadas) y los hitos confirmados. Abajo, cuánto va del acuerdo.
 */
function ClientTimeline({ project, meetings }: { project: Project; meetings: AgendaMeeting[] }) {
  const today = getTodayString();
  const mias = meetings.filter((m) => m.projectId === project.id && !m.proposed);
  const inicio = project.pafEtapasInicio || {};
  const desde = [project.startDate, ...mias.map((m) => m.date)].filter(Boolean).sort()[0] || today;
  const hasta = [today, ...mias.map((m) => m.date)].sort().slice(-1)[0];
  const meses: string[] = [];
  const cur = new Date(`${desde.slice(0, 7)}-01T12:00:00`);
  const fin = new Date(`${hasta.slice(0, 7)}-01T12:00:00`);
  fin.setMonth(fin.getMonth() + 1);
  while (cur <= fin && meses.length < 18) { meses.push(cur.toLocaleDateString('en-CA').slice(0, 7)); cur.setMonth(cur.getMonth() + 1); }
  const etapaDelMes = (mes: string): Etapa => {
    const fines = `${mes}-31`;
    return (['conversion', 'adquisicion'] as Etapa[]).find((e) => inicio[e] && inicio[e]! <= fines) || 'presencia';
  };
  const COLOR: Record<Etapa, string> = { presencia: 'bg-orange-400', adquisicion: 'bg-violet-500/70', conversion: 'bg-emerald-500/70' };
  const hitosMes = (mes: string) => (project.pafHitos || []).filter((h) => h.fecha.startsWith(mes)).length;
  const hechas = mias.filter((m) => m.completed).length;
  const acordadas = project.pafPortal?.reunionesAcordadas;
  const mesActual = today.slice(0, 7);
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="flex-1 text-xs font-bold text-zinc-100">Línea de tiempo</h3>
        <span className="text-[11px] text-zinc-400">{hechas} reuniones hechas{acordadas ? ` de ${acordadas} del acuerdo` : ''}</span>
      </div>
      <ol className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {meses.map((mes, i) => {
          const del = mias.filter((m) => m.date.startsWith(mes));
          const e = etapaDelMes(mes);
          return (
            <li key={mes} className={`min-w-[64px] flex-1 rounded-lg border p-1.5 ${mes === mesActual ? 'border-zinc-400' : 'border-zinc-800'}`}>
              <p className="text-[10px] text-zinc-400">Mes {i + 1} · <span className="capitalize">{new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span></p>
              <span className={`mt-1 block h-1.5 rounded-full ${mes > mesActual ? 'bg-zinc-800' : COLOR[e]}`} title={ETAPAS.find((x) => x.id === e)!.label} />
              <p className="mt-1.5 flex flex-wrap gap-0.5" aria-label={`${del.length} reuniones`}>
                {del.map((m) => <span key={m.id} title={`${m.date} · ${m.title}`} className={`w-2 h-2 rounded-full ${m.completed ? 'bg-zinc-200' : 'border border-zinc-400'}`} />)}
                {Array.from({ length: hitosMes(mes) }, (_, k) => <span key={`h${k}`} title="Hito confirmado" className="text-[9px] leading-none text-emerald-400">◆</span>)}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
        {ETAPAS.map((x) => <span key={x.id} className="inline-flex items-center gap-1"><span className={`w-2.5 h-1.5 rounded-full ${COLOR[x.id]}`} />{x.label}</span>)}
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-200" />reunión hecha</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-zinc-400" />agendada</span>
        <span className="inline-flex items-center gap-1"><span className="text-emerald-400">◆</span>hito</span>
      </p>
    </section>
  );
}

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
