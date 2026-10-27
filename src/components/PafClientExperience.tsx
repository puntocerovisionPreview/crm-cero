import React, { useLayoutEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, Circle, Clock, Layers, PlayCircle } from 'lucide-react';
import type { StudentPortalSnapshot } from '../utils/studentPortal';
import type { PanelSnapshot } from '../panels/model';
import { createPafPlan, PAF_MONTHS, PAF_WORK_LABELS, planProgress, safeResourceUrl } from '../panels/pafPlan';
import { PanelSections } from '../views/ClientPanelView';
import { formatDisplayDate } from '../utils/projectTimeline';
import { BrandLogo } from './BrandLogo';

type Tab = 'inicio' | 'plan' | 'contenido' | 'sesiones' | 'recursos';
const tabs: { id: Tab; label: string }[] = [{ id: 'inicio', label: 'Mi inicio' }, { id: 'plan', label: 'Mis 3 meses' }, { id: 'contenido', label: 'Contenido y redes' }, { id: 'sesiones', label: 'Sesiones' }, { id: 'recursos', label: 'Recursos' }];
const pillarNames = { presencia: 'Presencia', adquisicion: 'Adquisición', conversion: 'Funnel', general: 'Acompañamiento' };
const statusTone = { pendiente: 'bg-zinc-800 text-zinc-400', en_curso: 'bg-amber-400/10 text-amber-300', esperando_cliente: 'bg-sky-400/10 text-sky-300', entregado: 'bg-emerald-400/10 text-emerald-300' };

export function PafClientExperience({ data, panel, panelError, token }: { data: StudentPortalSnapshot; panel: PanelSnapshot | null; panelError?: boolean; token: string }) {
  useLayoutEffect(() => {
    // Las reglas globales del CRM convierten zinc a tema claro si html no tiene .dark.
    // Este espacio público conserva su propio contraste, incluso en una primera visita.
    const root = document.documentElement;
    const previousDark = root.classList.contains('dark');
    const previousScheme = root.style.colorScheme;
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    return () => {
      root.classList.toggle('dark', previousDark);
      root.style.colorScheme = previousScheme;
    };
  }, []);
  const [tab, setTab] = useState<Tab>('inicio');
  const fallback = createPafPlan({ projectType: data.programName.includes('Base') ? 'paf_base' : 'paf_pro' });
  // Un portal antiguo sigue funcionando; ningún avance se deduce de la fecha o etapa.
  const plan = panel?.paf || { ...fallback, items: data.roadmap?.length ? data.roadmap : fallback.items, cm: { enabled: false, scope: '' } };
  const progress = planProgress(plan);
  const inProgress = plan.items.filter((i) => i.status === 'en_curso');
  const waiting = plan.items.filter((i) => i.status === 'esperando_cliente');
  const nextItem = plan.items.find((i) => i.status === 'pendiente');
  const pendingTasks = panel?.tasks.filter((t) => !t.done).length || 0;
  const approvals = panel?.pieces.filter((p) => p.state === 'para_aprobar').length || 0;
  const week = data.currentWeek;
  const hoursPct = data.hoursTotal > 0 ? Math.min(100, Math.max(0, data.hoursDone * 100 / data.hoursTotal)) : 0;
  return <div className="min-h-screen bg-[#0B0F17] text-zinc-100 selection:bg-amber-400/30">
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
      <div className="flex items-center justify-between gap-3"><BrandLogo size="sm" /><span className="text-xs text-zinc-400">Tu espacio de trabajo con .Cero</span></div>
      <header className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">{data.programName} · Acompañamiento de 12 semanas</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight break-words">{data.studentName}</h1>
        <p className="mt-3 text-zinc-300 max-w-2xl leading-relaxed">Un lugar para ver qué construimos, qué sigue y cómo avanzar juntos.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-3 py-1.5">{data.graduated ? 'Programa finalizado' : week ? `Semana ${week} de ${data.totalWeeks}` : 'Preparando el inicio'}</span>
          {data.startDate && <span className="rounded-full border border-zinc-700 px-3 py-1.5">Inicio · {formatDisplayDate(data.startDate, 'medium')}</span>}
          {data.endDate && <span className="rounded-full border border-zinc-700 px-3 py-1.5">Cierre previsto · {formatDisplayDate(data.endDate, 'medium')}</span>}
        </div>
      </header>
      <nav aria-label="Secciones de tu programa" className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((t) => <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)} className={'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ' + (tab === t.id ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800')}>{t.label}{t.id === 'contenido' && approvals > 0 ? ` (${approvals})` : ''}</button>)}
      </nav>
      {panelError && <p role="alert" className="rounded-2xl border border-amber-500/30 p-4 text-sm text-amber-200">No pudimos cargar tus tareas y contenido. Tu programa sigue visible; recargá la página para volver a intentarlo.</p>}
      <main className="space-y-5" key={tab}>
        {tab === 'inicio' && <>
          {plan.goal && <Section title="Lo que queremos lograr"><p className="text-xl leading-relaxed text-zinc-100 whitespace-pre-line">{plan.goal}</p></Section>}
          {panel?.note && <Section title="Esta semana"><p className="text-zinc-300 whitespace-pre-line leading-relaxed">{panel.note}</p></Section>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Entregas completadas" value={`${progress.done} / ${progress.total}`} detail="Avance registrado por tu equipo" />
            <Stat label="Necesitamos de vos" value={String(pendingTasks + waiting.length)} detail="Tareas y aportes pendientes" />
            <Stat label="Contenido para revisar" value={String(approvals)} detail="Tu aprobación nos permite avanzar" />
          </div>
          <Section title="Así avanza tu sistema"><div className="flex items-center gap-3"><Bar pct={progress.percent} /><span className="text-sm text-emerald-300">{progress.percent}%</span></div><p className="text-xs text-zinc-500 mt-3">Este avance corresponde a entregas completadas. Las semanas transcurridas se muestran por separado.</p><button type="button" onClick={() => setTab('plan')} className="text-amber-300 text-sm mt-4 inline-flex items-center gap-2">Ver el plan de los tres meses <ArrowUpRight className="w-4 h-4" /></button></Section>
          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Estamos trabajando en">{inProgress.length ? <ul className="space-y-2">{inProgress.map((i) => <li key={i.id} className="text-sm text-zinc-200">{i.title}</li>)}</ul> : <p className="text-sm text-zinc-400">Tu etapa actual: {data.currentStage}. El equipo irá registrando acá las actividades en curso.</p>}</Section>
            <Section title="Tu próxima sesión">{data.nextSession ? <p className="flex items-center gap-2 text-zinc-200"><CalendarDays className="w-5 h-5 text-amber-400" />{formatDisplayDate(data.nextSession.date, 'medium')}{data.nextSession.time && ` · ${data.nextSession.time}`}</p> : <p className="text-sm text-zinc-400">La próxima sesión aparecerá cuando la coordinemos.</p>}<p className="text-xs text-zinc-500 mt-2">Confirmá la zona horaria con tu consultor.</p></Section>
          </div>
          {nextItem && <Section title="Lo que sigue"><p className="font-medium text-zinc-200">{nextItem.title}</p><p className="mt-2 text-xs text-zinc-500">Mes {nextItem.month}{nextItem.week ? ` · Semana prevista ${nextItem.week}` : ''} · {pillarNames[nextItem.pillar]}</p></Section>}
          {waiting.length > 0 && <Section title="Para poder avanzar"><ul className="space-y-3">{waiting.map((i) => <li key={i.id}><p className="text-sm font-medium text-sky-200">{i.title}</p>{i.detail && <p className="text-sm text-zinc-400 mt-1 whitespace-pre-line">{i.detail}</p>}</li>)}</ul></Section>}
          {panel ? <PanelSections token={token} data={panel} section="work" /> : <Section title="Trabajamos juntos"><p className="text-sm text-zinc-400">Las tareas y los objetivos semanales aparecerán acá cuando tu equipo los comparta.</p></Section>}
          {approvals > 0 && <button type="button" onClick={() => setTab('contenido')} className="w-full rounded-2xl border border-amber-500/30 bg-amber-400/5 p-4 text-amber-200 text-left">Tenés {approvals} piezas para revisar → Ir a contenido y redes</button>}
        </>}
        {tab === 'plan' && <>
          <div><h2 className="text-2xl font-semibold">Tus tres meses, paso a paso</h2><p className="text-zinc-400 mt-2 text-sm">Esta es la hoja de ruta de tu programa. Las semanas son orientativas; cada entrega conserva su estado real.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">{(['presencia', 'adquisicion', 'conversion'] as const).map((pillar) => {
            const items = plan.items.filter((i) => i.pillar === pillar);
            return <Stat key={pillar} label={pillarNames[pillar]} value={`${items.filter((i) => i.status === 'entregado').length} / ${items.length}`} detail="Entregables completados" />;
          })}</div>
          {PAF_MONTHS.map((month) => <Section key={month.month} title={`Mes ${month.month} · ${month.title}`}>
            <div className="flex gap-3 items-start"><span className="text-3xl font-semibold text-amber-400/70">0{month.month}</span><div><p className="text-xs text-amber-300">{month.weeks}</p><p className="text-sm text-zinc-400 mt-1">{month.description}</p></div></div>
            <ul className="mt-5 divide-y divide-zinc-800">{plan.items.filter((i) => i.month === month.month).map((item) => <li key={item.id} className="py-4 flex gap-3">
              {item.status === 'entregado' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-1" /> : <Circle className="w-5 h-5 text-zinc-600 shrink-0 mt-1" />}
              <div className="min-w-0 flex-1"><p className="font-medium text-zinc-100 break-words">{item.title}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className={'rounded-full px-2 py-1 ' + statusTone[item.status]}>{PAF_WORK_LABELS[item.status]}</span><span className="py-1 text-zinc-500">{pillarNames[item.pillar]}{item.week ? ` · Semana ${item.week}` : ''}</span></div>{item.detail && <p className="mt-2 text-sm text-zinc-400 whitespace-pre-line">{item.detail}</p>}</div>
            </li>)}</ul>
            {!plan.items.some((i) => i.month === month.month) && <p className="mt-4 text-sm text-zinc-400">Vamos a definir las actividades de este mes con tu estudio.</p>}
          </Section>)}
          {data.deliverables.length > 0 && <Section title={`Checklist de la etapa · ${data.currentStage}`}><ul className="space-y-3">{data.deliverables.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm">{d.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />}<span className={d.done ? 'text-zinc-400' : 'text-zinc-200'}>{d.text}</span></li>)}</ul></Section>}
        </>}
        {tab === 'contenido' && <>
          <div><h2 className="text-2xl font-semibold">Contenido y redes</h2><p className="text-sm text-zinc-400 mt-2">Cada pieza, su fecha y tus comentarios, en el mismo lugar.</p></div>
          {plan.cm.enabled && <Section title="Gestión de contenido y comunidad"><p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{plan.cm.scope || 'Estamos definiendo el alcance de la gestión con tu estudio.'}</p></Section>}
          <Section title="Cómo trabajamos"><ol className="grid gap-3 sm:grid-cols-4">{['Planificamos', 'Producimos', 'Revisás y aprobás', 'Publicamos y medimos'].map((step, i) => <li key={step} className="text-sm text-zinc-300"><span className="block text-amber-400 text-xs mb-1">0{i + 1}</span>{step}</li>)}</ol><p className="text-xs text-zinc-500 mt-4">Las piezas se publican según el calendario y el alcance acordado, después de tu aprobación.</p></Section>
          {panel && panel.pieces.length > 0 ? <PanelSections token={token} data={panel} section="content" /> : <Section title="Tu próximo contenido"><Layers className="w-6 h-6 text-zinc-600 mb-3" /><p className="text-sm text-zinc-400">Cuando compartamos las primeras piezas vas a poder revisarlas, aprobarlas o pedir cambios desde acá.</p></Section>}
        </>}
        {tab === 'sesiones' && <>
          <Section title="Tu acompañamiento 1:1"><div className="grid sm:grid-cols-3 gap-4"><Stat label="Horas acordadas" value={String(data.hoursTotal)} detail="Consultoría y mentoría" /><Stat label="Horas realizadas" value={String(data.hoursDone)} detail={`${data.sessions.length} sesiones registradas`} /><Stat label="Horas disponibles" value={String(data.hoursRemaining)} detail="Para seguir trabajando juntos" /></div><div className="mt-4"><Bar pct={hoursPct} /></div></Section>
          <Section title="Sesiones y grabaciones">{data.sessions.length ? <ul className="divide-y divide-zinc-800">{data.sessions.map((s, i) => <li key={i} className="py-4 flex gap-3"><Clock className="w-4 h-4 text-amber-300 mt-1 shrink-0" /><div className="min-w-0 flex-1"><p className="font-medium">{formatDisplayDate(s.date, 'medium')}{s.hours ? ` · ${s.hours} h` : ''}</p><p className="mt-1 text-sm text-zinc-400 whitespace-pre-line">{s.topics || 'Sesión de acompañamiento'}</p>{s.recordingUrl && safeResourceUrl(s.recordingUrl) && <a className="mt-3 inline-flex gap-2 items-center text-sm text-amber-300" href={safeResourceUrl(s.recordingUrl)!} target="_blank" rel="noopener noreferrer"><PlayCircle className="w-4 h-4" /> Ver grabación</a>}</div></li>)}</ul> : <p className="text-sm text-zinc-400">Después de cada sesión vas a encontrar acá los temas trabajados y la grabación, cuando esté disponible.</p>}</Section>
        </>}
        {tab === 'recursos' && <Section title="Todo lo que construimos para tu estudio"><p className="text-sm text-zinc-400 mb-4">Web, documentos, guías y materiales compartidos por tu equipo.</p>{plan.resources.length ? <ul className="grid sm:grid-cols-2 gap-3">{plan.resources.filter((r) => safeResourceUrl(r.url)).map((r) => <li key={r.id}><a href={safeResourceUrl(r.url)!} target="_blank" rel="noopener noreferrer" className="flex justify-between items-center gap-3 rounded-2xl bg-zinc-800/60 p-4 text-sm hover:bg-zinc-800"><span className="break-words">{r.title}</span><ArrowUpRight className="w-4 h-4 text-amber-300 shrink-0" /></a></li>)}</ul> : <p className="text-sm text-zinc-500">Los recursos aparecerán a medida que los preparemos y compartamos con vos.</p>}</Section>}
      </main>
      <footer className="border-t border-zinc-800 pt-5 text-xs text-zinc-500 flex flex-wrap justify-between gap-2"><span>.Cero · Presencia, adquisición y conversión</span><span>Última actualización · {formatDisplayDate((panel?.updatedAt || data.updatedAt).slice(0, 10), 'medium')}</span></footer>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"><h2 className="font-semibold text-zinc-100 mb-4">{title}</h2>{children}</section>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs text-zinc-400">{label}</p><p className="text-3xl font-semibold tracking-tight mt-2">{value}</p><p className="text-xs text-zinc-500 mt-2">{detail}</p></div>; }
function Bar({ pct }: { pct: number }) { return <div role="progressbar" aria-label="Avance registrado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="h-2 flex-1 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} /></div>; }
