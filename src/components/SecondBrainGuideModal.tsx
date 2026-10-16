import React from 'react';
import { 
  X, 
  Sparkles, 
  Network, 
  FileText, 
  Link2, 
  CheckCircle2, 
  ArrowRight, 
  Folder, 
  Layers, 
  BookOpen 
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SecondBrainGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-divider)] flex items-center justify-between bg-[var(--bg-app)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-heading">
                Guía Rápida: 2° Cerebro & Grafo
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Organización conectada de notas, clientes y proyectos
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              hapticFeedback.light();
              onClose();
            }}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-[var(--text-secondary)] leading-relaxed no-scrollbar">
          {/* Concept summary */}
          <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[11px]">
            <p className="text-[var(--text-primary)] font-medium">
              💡 <b>¿Qué es el 2° Cerebro?</b> Es tu base de conocimiento viva: centraliza minutas, acuerdos, briefs y estrategias. Cada vez que vinculas una nota a un cliente, se actualiza automáticamente su Ficha 360° y el Grafo de la empresa.
            </p>
          </div>

          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] flex items-center justify-center text-[10px] font-mono">1</span>
              <span>Crea Notas o usa Plantillas Rápidas</span>
            </div>
            <p className="text-[var(--text-secondary)] text-[11px]">
              Al redactar, haz clic en el botón <b>«Plantillas»</b> para insertar de inmediato estructuras prediseñadas: <i>Brief de Landing Page</i>, <i>Estrategia de Pauta / Audiencias</i>, <i>Minuta de Reunión</i> o <i>Kick-off de Proyecto</i>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] flex items-center justify-center text-[10px] font-mono">2</span>
              <span>Vincular con Corchetes Dobles <code className="bg-[var(--bg-surface-muted)] text-[var(--text-primary)] px-1 py-0.5 rounded font-mono font-bold">[[...]]</code></span>
            </div>
            <p className="text-[var(--text-secondary)] text-[11px]">
              Simplemente escribe <code className="text-[var(--text-primary)] font-mono font-semibold">[[Nombre]]</code> (ejemplo: <code className="font-mono text-[var(--text-primary)]">[[Estudio Cane]]</code>) y el buscador desplegará tus clientes, metas y notas. La nota quedará indexada de inmediato en la Ficha del cliente y en el Grafo sin configuración manual.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] flex items-center justify-center text-[10px] font-mono">3</span>
              <span>Grafo Interactivo & Filtros de Red</span>
            </div>
            <p className="text-[var(--text-secondary)] text-[11px]">
              El grafo simula la gravedad física de tus ideas en tiempo real. Usa los botones superiores <b>«Clientes & Notas»</b> para una vista limpia, arrastra nodos con el dedo o mouse, y toca cualquier círculo para ver sus menciones y abrir la entidad.
            </p>
          </div>

          {/* Mobile tip */}
          <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-[11px]">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--text-primary)]">Optimizado para celulares y tablets:</span>
              <p className="text-[var(--text-secondary)] mt-0.5">
                En pantallas móviles dispones de pestañas rápidas para alternar entre tu lista de notas, el editor a pantalla completa y el visor de grafo con zoom táctil y panel inferior deslizable.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[var(--border-divider)] bg-[var(--bg-app)] flex items-center justify-end">
          <button
            onClick={() => {
              hapticFeedback.light();
              onClose();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl btn-solid-primary text-xs font-semibold transition active:scale-95 cursor-pointer"
          >
            Entendido, ¡empezar a escribir!
          </button>
        </div>
      </div>
    </div>
  );
};
