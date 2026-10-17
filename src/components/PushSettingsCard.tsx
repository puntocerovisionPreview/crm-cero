import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { disablePush, enablePush, getCurrentSubscription, getPushSupport, sendTestPush, PushSupport } from '../utils/pushClient';

// Notificaciones nativas en este dispositivo (sin Telegram ni otras apps)
export const PushSettingsCard: React.FC = () => {
  const [support, setSupport] = useState<PushSupport>('ok');
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const s = getPushSupport();
    setSupport(s);
    setActive(s === 'ok' ? Boolean(await getCurrentSubscription().catch(() => null)) : false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const run = async (kind: 'on' | 'off' | 'test') => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'on') {
        await enablePush();
        const n = await sendTestPush();
        setMessage(n > 0 ? 'Listo. Te mandamos una notificación de prueba.' : 'Activadas, pero la prueba no llegó. Probá de nuevo en un minuto.');
      } else if (kind === 'off') {
        await disablePush();
        setMessage('Notificaciones desactivadas en este dispositivo.');
      } else {
        const n = await sendTestPush();
        setMessage(n > 0 ? `Enviada a ${n} ${n === 1 ? 'dispositivo' : 'dispositivos'}.` : 'No hay dispositivos activados.');
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  return (
    <section className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3" aria-labelledby="push-title">
      <div className="flex items-start gap-3">
        {active ? <Bell className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" aria-hidden /> : <BellOff className="w-5 h-5 text-[var(--text-tertiary)] shrink-0 mt-0.5" aria-hidden />}
        <div className="flex-1 min-w-0">
          <h3 id="push-title" className="text-sm font-semibold text-[var(--text-primary)]">Notificaciones en este dispositivo</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {support === 'ios-sin-instalar'
              ? 'En iPhone primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.'
              : support === 'no-soportado'
              ? 'Este navegador no permite notificaciones push. Probá con Chrome, Edge, Safari o la app instalada.'
              : support === 'bloqueado'
              ? 'Las notificaciones están bloqueadas para este sitio. Habilitalas en la configuración del navegador y volvé a intentar.'
              : active
              ? 'Activadas: te avisamos el resumen del día, reuniones y cobros, aunque la app esté cerrada.'
              : 'Recibí el resumen del día, avisos de reuniones y cobros aunque la app esté cerrada.'}
          </p>
        </div>
      </div>

      {support === 'ok' && active !== null && (
        <div className="flex flex-wrap gap-2">
          {!active ? (
            <button
              type="button"
              onClick={() => run('on')}
              disabled={busy !== null}
              className="px-3 py-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
            >
              {busy === 'on' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Bell className="w-4 h-4" aria-hidden />}
              Activar notificaciones
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => run('test')}
                disabled={busy !== null}
                className="px-3 py-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
                Enviar prueba
              </button>
              <button
                type="button"
                onClick={() => run('off')}
                disabled={busy !== null}
                className="px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-60"
              >
                {busy === 'off' ? 'Desactivando…' : 'Desactivar en este dispositivo'}
              </button>
            </>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-[var(--text-primary)] empty:hidden">
        {message || ''}
      </p>
    </section>
  );
};
