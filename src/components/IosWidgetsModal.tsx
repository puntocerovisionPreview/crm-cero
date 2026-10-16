import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Calendar, 
  CheckSquare, 
  Clock, 
  DollarSign, 
  Flame, 
  Download, 
  Plus, 
  ArrowRight,
  Layers,
  HelpCircle,
  FolderKanban,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { AgendaTask, AgendaMeeting, Project, IncomeRecord } from '../types';
import { getTodayString, formatDayName } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { generateBatchCalendarICS } from '../utils/calendarIcs';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  onOpenQuickAdd: (type: 'tarea' | 'reunion' | 'proyecto' | 'ingreso' | 'gasto') => void;
  onNavigate: (path: string) => void;
  onToggleTask?: (id: string) => void;
}

type WidgetSize = 'small' | 'medium' | 'large';
type ActiveTab = 'preview' | 'scriptable' | 'shortcuts' | 'calendar';

export const IosWidgetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tasks,
  meetings,
  projects,
  incomes,
  onOpenQuickAdd,
  onNavigate,
  onToggleTask,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('medium');
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  const today = getTodayString();
  const dayNameFormatted = formatDayName(today);
  const todayTasks = tasks.filter(t => t.date === today);
  const pendingTasks = todayTasks.filter(t => !t.completed);
  const completedTasks = todayTasks.filter(t => t.completed);
  const todayMeetings = meetings.filter(m => m.date === today);
  const nextMeeting = todayMeetings.find(m => !m.completed) || todayMeetings[0];

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://cero-crm.app';

  const shortcutsList = [
    {
      id: 'nueva-tarea',
      title: 'Nueva Tarea Rápida',
      subtitle: 'Abre el modal para crear una tarea de hoy',
      icon: <CheckSquare className="w-4 h-4 text-[var(--accent)]" />,
      url: `${appOrigin}/?action=nueva-tarea`,
      color: 'from-amber-500/20 to-orange-500/20 text-orange-400 border-orange-500/30',
    },
    {
      id: 'agenda-hoy',
      title: 'Ver Agenda de Hoy',
      subtitle: 'Acceso directo a las tareas y reuniones del día',
      icon: <Calendar className="w-4 h-4 text-sky-400" />,
      url: `${appOrigin}/?action=agenda-hoy`,
      color: 'from-sky-500/20 to-blue-500/20 text-sky-400 border-sky-500/30',
    },
    {
      id: 'modo-foco',
      title: 'Iniciar Modo Foco',
      subtitle: 'Abre la pantalla completa de trabajo con Pomodoro',
      icon: <Clock className="w-4 h-4 text-emerald-400" />,
      url: `${appOrigin}/?action=modo-foco`,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'nuevo-ingreso',
      title: 'Nuevo Cobro / Ingreso',
      subtitle: 'Registra un pago de cliente en USD o ARS',
      icon: <DollarSign className="w-4 h-4 text-amber-400" />,
      url: `${appOrigin}/?action=nuevo-ingreso`,
      color: 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30',
    },
  ];

  const handleCopyShortcutUrl = (url: string, id: string) => {
    hapticFeedback.success();
    navigator.clipboard.writeText(url);
    setCopiedShortcut(id);
    setTimeout(() => setCopiedShortcut(null), 2500);
  };

  // Generate Scriptable iOS Widget JavaScript code
  const scriptableWidgetCode = `// .Cero CRM - Widget iOS para iPhone 11 Pro / iOS 14+
// App: Scriptable (Descárgala gratis en el App Store)
// Widget: Tareas y Agenda Diaria en Vivo

const CRM_URL = "${appOrigin}";

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#09090b");
  widget.setPadding(16, 16, 16, 16);

  // Cabecera con Branding .Cero
  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const dot = headerStack.addText("● ");
  dot.font = Font.boldSystemFont(12);
  dot.textColor = new Color("#E8590C");

  const title = headerStack.addText(".CERO AGENDA");
  title.font = Font.blackSystemFont(11);
  title.textColor = new Color("#FAFAFA");

  headerStack.addSpacer();

  const df = new DateFormatter();
  df.dateFormat = "EEEE d";
  df.locale = "es_AR";
  const dateText = headerStack.addText(df.string(new Date()).toUpperCase());
  dateText.font = Font.boldSystemFont(10);
  dateText.textColor = new Color("#71717a");

  widget.addSpacer(10);

  // Cuerpo del Widget (Tareas y Reuniones)
  const contentStack = widget.addStack();
  contentStack.layoutVertically();

  // Métrica rápida
  const countStack = contentStack.addStack();
  countStack.layoutHorizontally();
  countStack.centerAlignContent();

  const countNum = countStack.addText("${pendingTasks.length}");
  countNum.font = Font.blackSystemFont(22);
  countNum.textColor = new Color("${pendingTasks.length > 0 ? '#E8590C' : '#10b981'}");

  countStack.addSpacer(6);

  const countLabel = countStack.addText("${pendingTasks.length === 1 ? 'tarea pendiente hoy' : 'tareas pendientes hoy'}");
  countLabel.font = Font.mediumSystemFont(12);
  countLabel.textColor = new Color("#d4d4d8");

  widget.addSpacer(8);

  // Lista de primeras tareas
  ${JSON.stringify(
    todayTasks.slice(0, 3).map(t => ({
      title: t.title,
      completed: t.completed,
      time: t.time || '',
    }))
  )}.forEach(t => {
    const itemStack = widget.addStack();
    itemStack.layoutHorizontally();
    itemStack.centerAlignContent();

    const bullet = itemStack.addText(t.completed ? "✓ " : "○ ");
    bullet.font = Font.boldSystemFont(11);
    bullet.textColor = new Color(t.completed ? "#10b981" : "#E8590C");

    const tText = itemStack.addText(t.title);
    tText.font = Font.systemFont(11);
    tText.textColor = new Color(t.completed ? "#52525b" : "#e4e4e7");
    tText.lineLimit = 1;

    if (t.time) {
      itemStack.addSpacer();
      const timeTxt = itemStack.addText(t.time);
      timeTxt.font = Font.mediumSystemFont(10);
      timeTxt.textColor = new Color("#71717a");
    }

    widget.addSpacer(3);
  });

  widget.addSpacer();

  // Pie con enlace directo a la app
  const footerStack = widget.addStack();
  footerStack.layoutHorizontally();
  footerStack.centerAlignContent();

  const openTxt = footerStack.addText("Tocar para abrir .Cero");
  openTxt.font = Font.mediumSystemFont(9);
  openTxt.textColor = new Color("#71717a");

  widget.url = CRM_URL + "/?action=agenda-hoy";
  return widget;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
`;

  const handleCopyScriptableCode = () => {
    hapticFeedback.success();
    navigator.clipboard.writeText(scriptableWidgetCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleExportCalendarFeed = () => {
    hapticFeedback.medium();
    const batchEvents = [
      ...tasks.map(t => ({
        title: t.title,
        description: t.projectName ? `Proyecto: ${t.projectName}` : 'Tarea .Cero CRM',
        date: t.date,
        time: t.time,
        alarmMinutesBefore: t.reminderMinutesBefore !== undefined ? t.reminderMinutesBefore : 15,
      })),
      ...meetings.map(m => ({
        title: `Reunión: ${m.title}`,
        description: [
          m.projectName ? `Proyecto: ${m.projectName}` : '',
          m.clientPhone ? `Tel: ${m.clientPhone}` : '',
          m.notes ? `Notas: ${m.notes}` : '',
        ].filter(Boolean).join('\n') || 'Reunión .Cero CRM',
        date: m.date,
        time: m.time,
        alarmMinutesBefore: m.reminderMinutesBefore !== undefined ? m.reminderMinutesBefore : 15,
      })),
    ];
    generateBatchCalendarICS(batchEvents, 'Agenda .Cero CRM');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header con estilo iOS Human Interface */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-amber-600 flex items-center justify-center text-white shadow-md shadow-[var(--accent)]/20">
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-zinc-100">
                  Widgets para iPhone & iOS
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] font-semibold">
                  iPhone 11 Pro
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Pantalla de Inicio, Lock Screen, Atajos rápidos y widget de Scriptable
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/60 overflow-x-auto no-scrollbar shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Simulador de Widget</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Atajos de iOS (1-Tap)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scriptable')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'scriptable'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Widget Real (Scriptable)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>Calendario Apple (.ics)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: INTERACTIVE SIMULATOR */}
          {activeTab === 'preview' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">
                    Vista previa de Widget iOS para iPhone 11 Pro
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Interactúa con tus datos en tiempo real tal como se verán en tu iPhone
                  </p>
                </div>

                {/* Size Selector */}
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
                  {(['small', 'medium', 'large'] as WidgetSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setWidgetSize(size);
                      }}
                      className={`px-2.5 py-1 rounded-lg transition capitalize ${
                        widgetSize === size
                          ? 'bg-[var(--accent)] text-black font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {size === 'small' ? 'Pequeño (2x2)' : size === 'medium' ? 'Mediano (4x2)' : 'Grande (4x4)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* iOS Screen / Springboard Container with OLED wallpaper simulation */}
              <div className="p-6 rounded-3xl bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950 border border-zinc-800 flex items-center justify-center relative overflow-hidden shadow-inner min-h-[300px]">
                
                {/* Decorative background grid resembling iOS home screen */}
                <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

                {/* SMALL WIDGET (2x2) */}
                {widgetSize === 'small' && (
                  <div className="w-40 h-40 rounded-[26px] bg-zinc-950/90 border border-zinc-800 p-3.5 shadow-2xl flex flex-col justify-between relative backdrop-blur-xl group hover:border-[var(--accent)]/50 transition-all">
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-extrabold text-[var(--accent)] tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                          .CERO
                        </span>
                        <span className="text-zinc-500 font-mono text-[9px]">HOY</span>
                      </div>
                      
                      <div className="mt-2">
                        <div className="text-2xl font-black font-mono text-zinc-100">
                          {pendingTasks.length}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium leading-tight">
                          {pendingTasks.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {todayTasks.slice(0, 1).map(t => (
                        <div key={t.id} className="text-[10px] text-zinc-300 truncate font-medium flex items-center gap-1">
                          <span className={t.completed ? 'text-emerald-400' : 'text-[var(--accent)]'}>•</span>
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}
                      {nextMeeting && (
                        <div className="text-[9px] text-amber-300 font-mono flex items-center gap-1 truncate">
                          <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span>{nextMeeting.time || '10:00'}</span>
                          <span className="truncate">{nextMeeting.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* MEDIUM WIDGET (4x2) */}
                {widgetSize === 'medium' && (
                  <div className="w-full max-w-sm h-40 rounded-[26px] bg-zinc-950/95 border border-zinc-800 p-4 shadow-2xl flex flex-col justify-between relative backdrop-blur-xl group hover:border-[var(--accent)]/50 transition-all">
                    <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                        <span className="font-extrabold text-xs text-zinc-100 tracking-wider">
                          .CERO AGENDA
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">
                        {dayNameFormatted}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-1 items-center">
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-2xl font-black text-amber-400">
                            {completedTasks.length}
                          </span>
                          <span className="text-xs text-zinc-500 font-semibold">
                            / {todayTasks.length} hechas
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-[var(--accent)]"
                            style={{ width: `${todayTasks.length > 0 ? (completedTasks.length / todayTasks.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {todayTasks.slice(0, 2).map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onToggleTask && onToggleTask(t.id)}
                            className="w-full text-left text-[11px] font-medium flex items-center gap-1.5 text-zinc-300 hover:text-white transition group/item"
                          >
                            {t.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            )}
                            <span className={`truncate ${t.completed ? 'line-through text-zinc-500' : ''}`}>
                              {t.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                      {nextMeeting ? (
                        <span className="flex items-center gap-1 text-amber-300 truncate">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{nextMeeting.time} {nextMeeting.title}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">Sin reuniones hoy</span>
                      )}
                      <span className="text-[9px] font-semibold text-[var(--accent)]">Tocar para abrir</span>
                    </div>
                  </div>
                )}

                {/* LARGE WIDGET (4x4) */}
                {widgetSize === 'large' && (
                  <div className="w-full max-w-sm h-80 rounded-[30px] bg-zinc-950/95 border border-zinc-800 p-5 shadow-2xl flex flex-col justify-between relative backdrop-blur-xl group hover:border-[var(--accent)]/50 transition-all">
                    <div>
                      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
                          <span className="font-black text-sm text-zinc-100 tracking-wider">
                            .CERO CRM
                          </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-400 uppercase">
                          {dayNameFormatted}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between bg-zinc-900/80 p-2.5 rounded-2xl border border-zinc-800">
                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase">Compromisos de Hoy</div>
                          <div className="text-lg font-black font-mono text-zinc-100">
                            {pendingTasks.length} pendientes
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenQuickAdd('tarea')}
                          className="p-2 rounded-xl bg-[var(--accent)] text-black font-bold text-xs flex items-center gap-1 active:scale-95 shadow-md shadow-[var(--accent)]/20"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Tarea</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 my-2 flex-1 overflow-y-auto no-scrollbar">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                        Lista de Tareas ({todayTasks.length})
                      </div>
                      {todayTasks.length === 0 ? (
                        <div className="text-xs text-zinc-500 py-3 text-center">
                          Todo al día para hoy 🎉
                        </div>
                      ) : (
                        todayTasks.slice(0, 4).map(t => (
                          <div
                            key={t.id}
                            onClick={() => onToggleTask && onToggleTask(t.id)}
                            className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs text-zinc-200 cursor-pointer hover:border-zinc-700 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {t.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-[var(--accent)] shrink-0" />
                              )}
                              <span className={`truncate font-medium ${t.completed ? 'line-through text-zinc-500' : ''}`}>
                                {t.title}
                              </span>
                            </div>
                            {t.projectName && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold shrink-0">
                                {t.projectName}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                        <Flame className="w-3.5 h-3.5" />
                        {completedTasks.length} completadas
                      </span>
                      <span className="text-[10px] text-zinc-500">iPhone 11 Pro Ready</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick instructions for Haptic Touch */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs text-zinc-300">
                <div className="font-bold text-zinc-100 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[var(--accent)]" />
                  <span>Cómo instalarlo en tu iPhone 11 Pro:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400 leading-relaxed">
                  <li>Abrí esta app en Safari desde tu iPhone 11 Pro.</li>
                  <li>Tocá el botón de <strong className="text-zinc-200">Compartir</strong> (ícono de flecha hacia arriba) en la barra inferior de Safari.</li>
                  <li>Seleccioná <strong className="text-zinc-200">"Agregar a pantalla de inicio"</strong>.</li>
                  <li>Al mantener presionado el ícono en tu iPhone (<strong className="text-zinc-200">Haptic Touch</strong>), se desplegarán las acciones rápidas de Nueva Tarea, Agenda Hoy y Modo Foco.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: ATJOS DE IOS (APPLE SHORTCUTS) */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100">
                  Atajos de iOS para Widgets y Pantalla de Bloqueo
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Puedes colocar estos atajos como botones de widget en tu iPhone 11 Pro o en la pantalla de bloqueo (Lock Screen).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shortcutsList.map(sc => (
                  <div
                    key={sc.id}
                    className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${sc.color}`}>
                        {sc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-zinc-100 truncate">
                          {sc.title}
                        </div>
                        <div className="text-xs text-zinc-400 line-clamp-1">
                          {sc.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyShortcutUrl(sc.url, sc.id)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        {copiedShortcut === sc.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">¡URL Copiada!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar URL para Atajos</span>
                          </>
                        )}
                      </button>

                      <a
                        href={sc.url}
                        className="p-1.5 rounded-xl bg-zinc-800 hover:bg-[var(--accent)] hover:text-black text-zinc-300 text-xs font-bold transition flex items-center justify-center"
                        title="Probar acción ahora"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Guía para configurar Atajo en iPhone */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 text-xs text-zinc-300 space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Paso a paso para crear el Widget de Atajos en tu iPhone 11 Pro:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-300/90 leading-relaxed">
                  <li>Abrí la app <strong className="text-white">Atajos (Shortcuts)</strong> en tu iPhone.</li>
                  <li>Tocá <strong className="text-white">+</strong> para crear un atajo nuevo.</li>
                  <li>Buscá la acción <strong className="text-white">"Abrir URL"</strong> (Open URLs) en Safari o Web.</li>
                  <li>Pegá la URL copiada arriba y ponele de nombre <strong className="text-white">"Nueva Tarea .Cero"</strong>.</li>
                  <li>En tu pantalla de inicio, mantén presionado el fondo, tocá <strong className="text-white">+</strong> en la esquina, elegí el widget de <strong className="text-white">Atajos</strong> y seleccioná tu nuevo atajo.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: SCRIPTABLE REAL WIDGET */}
          {activeTab === 'scriptable' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>Widget Nativo de JavaScript con Scriptable</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    100% Funcional en iOS
                  </span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Scriptable es una app gratuita para iOS que permite ejecutar widgets de código nativo directamente en la pantalla de inicio del iPhone 11 Pro.
                </p>
              </div>

              {/* Actions Header */}
              <div className="flex items-center justify-between gap-3">
                <a
                  href="https://apps.apple.com/app/scriptable/id1405459188"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Descargar Scriptable en App Store</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyScriptableCode}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-black font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20 active:scale-95 cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>¡Código Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Código del Widget</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code snippet block */}
              <div className="relative rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden text-xs">
                <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-zinc-400 font-mono text-[11px]">
                  <span>cero-crm-widget.js</span>
                  <span>JavaScript (iOS WidgetKit API)</span>
                </div>
                <pre className="p-4 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed">
                  {scriptableWidgetCode}
                </pre>
              </div>

              {/* Steps Guide */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 space-y-2">
                <div className="font-bold text-zinc-100">
                  Instalación en 3 pasos:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-zinc-400">
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                    <span className="font-black text-[var(--accent)] text-sm">1.</span>
                    <p className="mt-1">Abrí Scriptable en tu iPhone y tocá <strong>"+"</strong> para crear un script.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                    <span className="font-black text-[var(--accent)] text-sm">2.</span>
                    <p className="mt-1">Pegá el código copiado arriba y ponele de nombre <strong>".Cero Agenda"</strong>.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                    <span className="font-black text-[var(--accent)] text-sm">3.</span>
                    <p className="mt-1">Añadí el widget de Scriptable en tu pantalla de inicio y elegí tu script.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CALENDAR SYNC (.ICS) */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100">
                  Sincronización con el Widget Nativo de Calendario de Apple
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  El widget oficial de Calendario que ya viene preinstalado en tu iPhone 11 Pro puede mostrar todas tus tareas y reuniones de .Cero CRM.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-zinc-100">
                      Archivo de Calendario Universal (.ics)
                    </h5>
                    <p className="text-xs text-zinc-400">
                      Incluye tus {tasks.length} tareas y {meetings.length} reuniones con recordatorios automáticos 15 minutos antes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportCalendarFeed}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 active:scale-98 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar y Abrir en Calendario de iPhone</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 space-y-2">
                <div className="font-bold text-zinc-100">
                  Cómo funciona en tu iPhone 11 Pro:
                </div>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed">
                  <li>Al tocar el botón de descarga en Safari de tu iPhone, iOS te preguntará si deseas <strong>"Añadir todos los eventos al Calendario"</strong>.</li>
                  <li>Una vez importados, el widget nativo de Calendario de iOS mostrará tus compromisos de .Cero directamente en tu pantalla de inicio o en la vista "Hoy" (swipe a la izquierda).</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Optimizado para iOS 16 / 17 / 18 en iPhone 11 Pro</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
