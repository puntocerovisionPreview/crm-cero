import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed, hide prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Instalar en iPhone</span>
        </button>

        {showIOSGuide && (
          <div 
            id="ios-pwa-guide-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div 
              id="ios-pwa-guide-modal"
              className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-left space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]/40 flex items-center justify-center text-[var(--accent)] font-bold text-sm">
                    .0
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">Instalar en tu iPhone</h3>
                    <p className="text-xs text-zinc-400">Usalo a pantalla completa como una App nativa</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-zinc-300 py-1">
                <div className="flex items-start gap-3 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-300 shrink-0 mt-0.5">
                    <Share2 className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-100">Paso 1:</span> En la barra inferior de Safari, tocá el botón de <strong className="text-zinc-100">Compartir</strong> (ícono de caja con flecha arriba).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-300 shrink-0 mt-0.5">
                    <PlusSquare className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-100">Paso 2:</span> Deslizá hacia abajo y seleccioná <strong className="text-zinc-100">"Agregar a pantalla de inicio"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="p-1.5 bg-zinc-800 rounded-lg text-emerald-400 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-100">Paso 3:</span> Tocá <strong className="text-zinc-100">"Agregar"</strong> arriba a la derecha. ¡Listo! Tendrás el ícono de .Cero en tu inicio.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
              >
                Cerrar Guía
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
