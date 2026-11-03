import React from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import {
  clearGoogleCalendarError,
  connectGoogleCalendar,
  disconnectGoogleCalendarMemory,
  useGoogleCalendarBrowser,
} from '../utils/googleCalendarBrowser';
import { hapticFeedback } from '../utils/haptics';

export const GoogleCalendarSettingsCard: React.FC<{
  onConnected?: () => void;
}> = ({ onConnected }) => {
  const { connected, connecting, tokenExpired, error, pendingCount } = useGoogleCalendarBrowser();

  const handleConnect = async () => {
    hapticFeedback.light();
    const res = await connectGoogleCalendar();
    if (res.ok) {
      hapticFeedback.success();
      onConnected?.();
    } else {
      hapticFeedback.error();
    }
  };

  return (
    <div className="card-swiss p-4 bg-[var(--bg-surface)] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0 mt-0.5">
            {connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[1.75]" />
            ) : tokenExpired ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 stroke-[1.75]" />
            ) : (
              <Calendar className="w-4 h-4 text-sky-400 stroke-[1.75]" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                Google Calendar (conexión directa)
              </h2>
              {connected && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  Conectado en memoria
                </span>
              )}
              {tokenExpired && !connected && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  Token vencido
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {connected
                ? 'Las reuniones que crees, edites o borres se sincronizan en vivo con tu calendario principal. El token se guarda solo en memoria (~1 h).'
                : tokenExpired
                ? `Tu sesión de Google Calendar venció${pendingCount > 0 ? ` (${pendingCount} cambio${pendingCount === 1 ? '' : 's'} en espera)` : ''}. Reconectá para sincronizar sin perder lo cargado.`
                : 'Conectá tu Google Calendar para crear, editar y borrar eventos directamente desde la app. El permiso se pide solo al tocar el botón.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {connected && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                disconnectGoogleCalendarMemory();
              }}
              className="px-2.5 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
            >
              Desconectar
            </button>
          )}
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="px-3.5 py-2 rounded-[var(--radius-control)] bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : connected || tokenExpired ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
            <span>
              {tokenExpired || connected ? 'Reconectar Google Calendar' : 'Conectar Google Calendar'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start justify-between gap-2 text-xs text-amber-200"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-100">
                {error.kind === 'popup_blocked' && 'Ventana emergente bloqueada'}
                {error.kind === 'permission_denied' && 'Permiso rechazado'}
                {error.kind === 'token_expired' && 'Token vencido (401)'}
                {error.kind === 'api_error' && 'Fallo de la API de Google Calendar'}
              </p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">{error.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearGoogleCalendarError}
            aria-label="Cerrar aviso"
            className="p-1 text-amber-300/70 hover:text-amber-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Banner global no intrusivo que aparece cuando la API devuelve 401 (token vencido)
 * o falla una operación, permitiendo tocar "Reconectar Google Calendar" sin perder
 * ningún formulario o carga en curso.
 */
export const GoogleCalendarReconnectBanner: React.FC<{
  onReconnected?: () => void;
}> = ({ onReconnected }) => {
  const { tokenExpired, error, connecting, pendingCount } = useGoogleCalendarBrowser();

  if (!tokenExpired && !error) return null;

  const handleReconnect = async () => {
    hapticFeedback.light();
    const res = await connectGoogleCalendar();
    if (res.ok) {
      hapticFeedback.success();
      onReconnected?.();
    } else {
      hapticFeedback.error();
    }
  };

  return (
    <div
      role="alert"
      className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-amber-500/35 bg-zinc-950/95 backdrop-blur-md p-3.5 shadow-2xl text-zinc-100 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-zinc-100">
              {tokenExpired || error?.kind === 'token_expired'
                ? 'Sesión de Google Calendar vencida'
                : error?.kind === 'popup_blocked'
                ? 'Popup bloqueado por el navegador'
                : error?.kind === 'permission_denied'
                ? 'Permiso de Google Calendar rechazado'
                : 'Error de Google Calendar'}
            </p>
            <button
              type="button"
              onClick={clearGoogleCalendarError}
              aria-label="Cerrar alerta"
              className="text-zinc-500 hover:text-zinc-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            {error?.message ||
              'El token de Google Calendar dura ~1 hora. Reconectá para aplicar los cambios sin perder lo que estabas cargando.'}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleReconnect}
              disabled={connecting}
              className="px-3 py-1.5 rounded-xl bg-amber-400 text-zinc-950 hover:bg-amber-300 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Reconectar Google Calendar</span>
            </button>
            {pendingCount > 0 && (
              <span className="text-[10px] text-amber-300">
                {pendingCount} {pendingCount === 1 ? 'cambio listo para reenviar' : 'cambios listos para reenviar'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
