import React, { useState, useRef } from 'react';
import { ViewTab, SyncStatus } from '../types';
import { BrandLogo } from './BrandLogo';
import { 
  Calendar, 
  CalendarDays,
  FolderKanban, 
  DollarSign, 
  Sun, 
  Moon, 
  Download, 
  UploadCloud, 
  FileSpreadsheet,
  Smartphone,
  Share2,
  PlusSquare,
  X,
  Check,
  Loader2,
  Cloud,
  CloudOff,
  Lock,
  MoreVertical,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Bell,
  Search,
  Keyboard,
  Plus,
  Clock,
  Award,
  BookOpen,
  Globe,
  GraduationCap
} from 'lucide-react';
import { requestNotificationPermission, getNotificationPermissionStatus, showSystemNotification } from '../utils/notifications';

interface Props {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onOpenQuickAdd: () => void;
  onOpenCommandPalette?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImportJSON: (file: File) => void;
  syncStatus: SyncStatus;
  onLockSession: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  soundEnabled?: boolean;
  privacyMode?: boolean;
  onTogglePrivacy?: () => void;
  onToggleSound?: () => void;
  onResetDatabase?: () => void;
  onRefreshSync?: () => void;
  onOpenPomodoro?: () => void;
  onOpenPafGuide?: () => void;
}

export const Header: React.FC<Props> = ({
  activeTab,
  onTabChange,
  onOpenQuickAdd,
  onOpenCommandPalette,
  onOpenKeyboardShortcuts,
  onExportJSON,
  onExportCSV,
  onImportJSON,
  syncStatus,
  onLockSession,
  theme,
  onToggleTheme,
  soundEnabled = true,
  privacyMode = false,
  onTogglePrivacy,
  onToggleSound,
  onResetDatabase,
  onRefreshSync,
  onOpenPomodoro,
  onOpenPafGuide,
}) => {
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" /> },
    { id: 'calendario', label: 'Calendario 360°', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'web', label: 'Desarrollo Web', icon: <Globe className="w-4 h-4" /> },
    { id: 'paf', label: 'Método PAF', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'ingresos', label: 'Finanzas', icon: <DollarSign className="w-4 h-4" /> },
  ];

  const currentTab = activeTab === 'proyectos' ? 'web' : activeTab;

  return (
    <>
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-3 safe-area-pt transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange('agenda')}
              className="flex items-center group text-left cursor-pointer"
            >
              <BrandLogo size="sm" />
            </button>

            {/* Desktop Navigation Tabs - Strictly Separated */}
            <nav className="hidden md:flex items-center gap-1 ml-3 bg-zinc-900/80 border border-zinc-800/80 p-1 rounded-xl shadow-sm">
              {tabs.map(tab => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#E8590C] text-white shadow-sm shadow-[#E8590C]/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Action Bar - Streamlined, Uncrowded & Sectorized */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Desktop Quick Command Search Icon */}
            {onOpenCommandPalette && (
              <button
                onClick={onOpenCommandPalette}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition shadow-sm"
                title="Buscar o comandos (⌘K)"
              >
                <Search className="w-3.5 h-3.5 text-[#E8590C]" />
                <span className="hidden lg:inline text-zinc-400">Buscar...</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-zinc-950 text-zinc-400 border border-zinc-800">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Pomodoro Focus Launcher Button */}
            {onOpenPomodoro && (
              <button
                type="button"
                onClick={onOpenPomodoro}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition shadow-sm active:scale-95 group"
                title="Temporizador Pomodoro (25m)"
              >
                <Clock className="w-3.5 h-3.5 text-[#E8590C] group-hover:animate-spin" />
                <span className="hidden sm:inline">Pomodoro</span>
                <span className="text-[10px] text-zinc-500 font-mono">25m</span>
              </button>
            )}

            {/* Primary Action "+ Nuevo" CTA Button */}
            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#E8590C] hover:bg-[#d44d07] text-white text-xs font-bold transition shadow-sm shadow-[#E8590C]/25 active:scale-95"
              title="Crear nueva tarea, reunión o proyecto (T / R / P)"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo</span>
            </button>

            {/* Cloud Sync Status Indicator - Compact Icon with Tooltip */}
            <div className="relative">
              <button
                onClick={onRefreshSync}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition shadow-sm"
                title={
                  syncStatus === 'syncing'
                    ? 'Sincronizando cambios con la nube...'
                    : syncStatus === 'synced'
                    ? 'Nube: Todo sincronizado'
                    : 'Modo sin conexión'
                }
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                ) : syncStatus === 'synced' ? (
                  <Cloud className="w-4 h-4 text-emerald-400" />
                ) : (
                  <CloudOff className="w-4 h-4 text-zinc-500" />
                )}
              </button>
            </div>

            {/* Sectorized Tools & Settings Menu ("···") */}
            <div className="relative">
              <button
                onClick={() => setShowOverflowMenu(prev => !prev)}
                className={`p-2 rounded-xl border transition shadow-sm active:scale-95 ${
                  showOverflowMenu 
                    ? 'bg-[#E8590C] text-white border-[#E8590C]' 
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Herramientas y Opciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Overflow Dropdown - Sectorized by Functional Purpose */}
              {showOverflowMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowOverflowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-zinc-800/70">
                    {/* SECTOR 1: PRODUCTIVIDAD & FOCO */}
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Productividad & Enfoque
                      </div>

                      {onOpenPomodoro && (
                        <button
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onOpenPomodoro();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-[#E8590C]" />
                            <span>Temporizador Pomodoro</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">25m</span>
                        </button>
                      )}

                      {onTogglePrivacy && (
                        <button
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onTogglePrivacy();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            {privacyMode ? (
                              <EyeOff className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-zinc-400" />
                            )}
                            <span>Modo Privacidad</span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${privacyMode ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-500'}`}>
                            {privacyMode ? 'Activo' : 'Off'}
                          </span>
                        </button>
                      )}

                      {onOpenKeyboardShortcuts && (
                        <button
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onOpenKeyboardShortcuts();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <Keyboard className="w-4 h-4 text-zinc-400" />
                            <span>Atajos de Teclado</span>
                          </div>
                          <kbd className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">?</kbd>
                        </button>
                      )}
                    </div>

                    {/* SECTOR 2: PROGRAMA PAF */}
                    {onOpenPafGuide && (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
                          Método PAF (Arquitectos)
                        </div>
                        <button
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onOpenPafGuide();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-zinc-800 hover:text-amber-200 transition text-left"
                        >
                          <Award className="w-4 h-4 text-amber-400" />
                          <span>Guía del Programa (12 Semanas)</span>
                        </button>
                      </div>
                    )}

                    {/* SECTOR 3: AJUSTES & PREFERENCIAS */}
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Ajustes & Sistema
                      </div>

                      <button
                        onClick={() => {
                          setShowOverflowMenu(false);
                          onToggleTheme();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          {theme === 'dark' ? (
                            <Sun className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Moon className="w-4 h-4 text-sky-400" />
                          )}
                          <span>Tema {theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">Cambiar</span>
                      </button>

                      {onToggleSound && (
                        <button
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onToggleSound();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            {soundEnabled ? (
                              <Volume2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <VolumeX className="w-4 h-4 text-zinc-500" />
                            )}
                            <span>Efectos de Sonido</span>
                          </div>
                          <span className="text-[10px] text-zinc-500">{soundEnabled ? 'Sí' : 'No'}</span>
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          setShowOverflowMenu(false);
                          const status = await requestNotificationPermission();
                          if (status === 'granted') {
                            showSystemNotification('Notificaciones .Cero Activadas', {
                              body: 'Te avisaremos cuando tengas tareas o reuniones por cumplir.',
                            });
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                      >
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span>Activar Notificaciones</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowOverflowMenu(false);
                          setShowBackupModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                      >
                        <Download className="w-4 h-4 text-[#E8590C]" />
                        <span>Copia de seguridad & datos</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowOverflowMenu(false);
                          setShowIOSModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition text-left"
                      >
                        <Smartphone className="w-4 h-4 text-[#E8590C]" />
                        <span>Instalar app en iPhone</span>
                      </button>

                      {onLockSession && (
                        <button
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onLockSession();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition text-left"
                        >
                          <Lock className="w-4 h-4" />
                          <span>Bloquear Sesión</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Download className="w-4 h-4 text-[#E8590C]" />
                <span>Copia de Seguridad & Datos</span>
              </h3>
              <button
                onClick={() => setShowBackupModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Tus datos están protegidos por tu código 0720 y sincronizados continuamente en la nube. Puedes descargar copias adicionales aquí:
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowBackupModal(false);
                  setShowIOSModal(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#E8590C]/10 hover:bg-[#E8590C]/20 border border-[#E8590C]/30 text-left transition"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-[#E8590C]" />
                  <div>
                    <div className="text-xs font-bold text-zinc-100">Instalar en tu iPhone</div>
                    <div className="text-[10px] text-zinc-400">Paso a paso para usar como App nativa</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportJSON();
                  setShowBackupModal(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Exportar Backup JSON</div>
                    <div className="text-[10px] text-zinc-500">Copia completa de tus 3 módulos</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportCSV();
                  setShowBackupModal(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Exportar Planilla CSV</div>
                    <div className="text-[10px] text-zinc-500">Para abrir en Excel o Google Sheets</div>
                  </div>
                </div>
              </button>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportJSON(file);
                      setShowBackupModal(false);
                    }
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition"
                >
                  <div className="flex items-center gap-2.5">
                    <UploadCloud className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">Restaurar Backup JSON</div>
                      <div className="text-[10px] text-zinc-500">Cargar archivo de respaldo previo</div>
                    </div>
                  </div>
                </button>
              </div>

              {onResetDatabase && (
                <div className="pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setShowBackupModal(false);
                      onResetDatabase();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 text-left transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <div>
                        <div className="text-xs font-semibold text-red-300">Vaciar y reiniciar base a 0</div>
                        <div className="text-[10px] text-red-400/70">Borra tareas de prueba y deja la app limpia</div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated iOS Safari Install Guide Modal */}
      {showIOSModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowIOSModal(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-left space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8590C]/20 border border-[#E8590C]/40 flex items-center justify-center text-[#E8590C] font-extrabold text-sm">
                  .C
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Instalar en tu iPhone</h3>
                  <p className="text-xs text-zinc-400">Funciona a pantalla completa sin barra de Safari</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIOSModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 py-1">
              <div className="flex items-start gap-3 p-3 bg-zinc-950/90 rounded-xl border border-zinc-800">
                <div className="p-1.5 bg-zinc-800 rounded-lg text-[#E8590C] shrink-0 mt-0.5">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-zinc-100">1. Tocá Compartir en Safari:</span> En la barra inferior del navegador Safari en tu iPhone, tocá el botón central de compartir (el cuadrado con la flecha hacia arriba).
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-950/90 rounded-xl border border-zinc-800">
                <div className="p-1.5 bg-zinc-800 rounded-lg text-[#E8590C] shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-zinc-100">2. "Agregar a pantalla de inicio":</span> Deslizá el menú hacia abajo y tocá la opción con el símbolo <strong className="text-zinc-100">[+]</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-950/90 rounded-xl border border-zinc-800">
                <div className="p-1.5 bg-emerald-500/15 rounded-lg text-emerald-400 shrink-0 mt-0.5 font-bold">
                  ✓
                </div>
                <div>
                  <span className="font-bold text-zinc-100">3. Tocá "Agregar":</span> Arriba a la derecha. ¡Listo! Se creará el ícono oficial de <strong>.Cero CRM</strong> en tu pantalla de inicio y se abrirá como app nativa.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-950/90 rounded-xl border border-[#E8590C]/30">
                <div className="p-1.5 bg-[#E8590C]/15 rounded-lg text-[#E8590C] shrink-0 mt-0.5 font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-[#E8590C]">4. Avisos en Pantalla de Bloqueo:</span>
                  <div className="text-zinc-300 mt-0.5">
                    Al cargar una tarea o reunión, activá <strong className="text-zinc-100">"Sincronizar con Calendario/Recordatorios"</strong> para que suene y aparezca en tu <strong>pantalla bloqueada</strong> sin importar si el teléfono está en reposo.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-950/90 rounded-xl border border-sky-500/30">
                <div className="p-1.5 bg-sky-500/15 rounded-lg text-sky-400 shrink-0 mt-0.5 font-bold">
                  🎙️
                </div>
                <div>
                  <span className="font-bold text-sky-400">5. Dictado por voz en iPhone:</span>
                  <div className="text-zinc-300 mt-0.5">
                    En iOS, Apple restringe el micrófono a la web al agregarse al inicio. Para hablar y dictar cualquier tarea o nota, <strong className="text-zinc-100">tocá cualquier campo y presioná el botón del micrófono (🎙️) en el teclado de tu iPhone</strong>. ¡Dicta en tiempo real con 100% de precisión!
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#E8590C] hover:bg-[#cf4d07] text-white text-xs font-bold transition shadow-md shadow-[#E8590C]/20"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
