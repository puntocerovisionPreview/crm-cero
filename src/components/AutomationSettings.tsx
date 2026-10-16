import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Send, Eye, RefreshCw, Copy, Check } from 'lucide-react';
import { getAuthHeaders } from '../utils/authAccess';

interface Status {
  serviceAccount: boolean;
  serviceAccountEmail: string | null;
  telegramToken: boolean;
  telegramChat: boolean;
  telegramChatName: string | null;
  cronSecret: boolean;
  calendar: boolean;
  calendarId: string | null;
}

type Job = 'daily-brief' | 'reminders' | 'weekly' | 'calendar-sync';

const JOBS: { id: Job; title: string; when: string; path: string }[] = [
  { id: 'daily-brief', title: 'Resumen del día', when: 'Todos los días a las 8:00', path: 'daily-brief' },
  { id: 'weekly', title: 'Plan de la semana', when: 'Domingos a las 19:00', path: 'weekly' },
  { id: 'reminders', title: 'Avisos de reuniones y tareas', when: 'Cada 10 minutos (junto con el calendario)', path: 'frequent' },
  { id: 'calendar-sync', title: 'Sincronizar Google Calendar', when: 'Cada 10 minutos (junto con los avisos)', path: 'frequent' },
];

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// Telegram usa HTML simple: lo mostramos como texto legible en la vista previa
function htmlToText(html: string): string {
  return html.replace(/<\/?(b|i)>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

const Step: React.FC<{ done: boolean; title: string; children?: React.ReactNode }> = ({ done, title, children }) => (
  <li className="flex gap-3">
    {done ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
    ) : (
      <Circle className="w-5 h-5 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
    )}
    <div className="space-y-1.5 min-w-0 flex-1">
      <p className={`text-sm font-semibold ${done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{title}</p>
      {children && <div className="text-xs text-[var(--text-secondary)] space-y-1.5">{children}</div>}
    </div>
  </li>
);

export const AutomationSettings: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setStatus(await api('/api/automation/status'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const linkTelegram = async () => {
    setBusy('link');
    setNotice(null);
    try {
      const r = await api('/api/automation/telegram/link', { method: 'POST' });
      setNotice(`Telegram conectado con ${r.chatName}. Te mandamos un mensaje de prueba.`);
      await load();
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const run = async (job: Job, dryRun: boolean) => {
    setBusy(`${job}-${dryRun}`);
    setNotice(null);
    try {
      const r = await api('/api/automation/run', { method: 'POST', body: JSON.stringify({ job, dryRun }) });
      const title = JOBS.find((j) => j.id === job)?.title || job;
      if (r.skipped) setNotice(`${title}: ${r.skipped}`);
      else if (dryRun) {
        const text =
          typeof r.detail === 'string'
            ? htmlToText(r.detail)
            : job === 'calendar-sync'
            ? `Se crearían ${r.detail.createdInGoogle} eventos en Google, se actualizarían ${r.detail.updatedInGoogle}, se borrarían ${r.detail.deletedInGoogle}; entrarían ${r.detail.createdInCrm} reuniones nuevas al CRM y se actualizarían ${r.detail.updatedInCrm}.`
            : Array.isArray(r.detail) && r.detail.length
            ? r.detail.map((x: any) => `${x.time} ${x.title}`).join('\n')
            : 'No hay avisos pendientes en este momento.';
        setPreview({ title, text });
      } else setNotice(job === 'calendar-sync' ? 'Calendario sincronizado.' : `${title}: enviado a Telegram.`);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ready = Boolean(status?.serviceAccount && status?.telegramToken && status?.telegramChat && status?.cronSecret);

  return (
    <div className="card-swiss p-4 sm:p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Automatizaciones</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Tu CRM te escribe por Telegram y sincroniza tu Google Calendar, aunque la app esté cerrada.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
          title="Volver a revisar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-sm text-red-400">No se pudo leer el estado: {error}</p>}
      {!status && !error && <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />}

      {status && (
        <ol className="space-y-4">
          <Step done={status.serviceAccount} title="1. Clave de servicio de Firebase">
            {status.serviceAccount ? (
              <p>Conectada ({status.serviceAccountEmail}).</p>
            ) : (
              <p>
                En la consola de Firebase: Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. Pegá
                todo el contenido del archivo en los Secrets de AI Studio como <code>FIREBASE_SERVICE_ACCOUNT</code>.
              </p>
            )}
          </Step>

          <Step done={status.telegramToken && status.telegramChat} title="2. Bot de Telegram">
            {!status.telegramToken && (
              <p>
                En Telegram hablale a <b>@BotFather</b>, mandá <code>/newbot</code> y seguí los pasos. Copiá el token que te da y
                guardalo en los Secrets como <code>TELEGRAM_BOT_TOKEN</code>.
              </p>
            )}
            {status.telegramToken && !status.telegramChat && (
              <>
                <p>Abrí tu bot en Telegram y mandale <code>/start</code>. Después tocá:</p>
                <button
                  type="button"
                  onClick={linkTelegram}
                  disabled={busy === 'link' || !status.serviceAccount}
                  className="px-3 py-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy === 'link' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Conectar Telegram
                </button>
              </>
            )}
            {status.telegramChat && <p>Conectado con {status.telegramChatName || 'tu chat'}.</p>}
          </Step>

          <Step done={status.cronSecret} title="3. Reloj automático">
            {!status.cronSecret ? (
              <p>
                Inventá una clave larga (mínimo 16 caracteres, sin espacios) y guardala en los Secrets como{' '}
                <code>CRON_SECRET</code>.
              </p>
            ) : (
              <>
                <p>
                  Creá una cuenta gratis en <b>cron-job.org</b> (o usá Google Cloud Scheduler) y agregá estas 3 tareas,
                  reemplazando <code>TU_CLAVE</code> por tu CRON_SECRET:
                </p>
                <ul className="space-y-1.5">
                  {[
                    ['diario', 'Todos los días 8:00', `${origin}/api/cron/daily-brief?key=TU_CLAVE`],
                    ['semanal', 'Domingos 19:00', `${origin}/api/cron/weekly?key=TU_CLAVE`],
                    ['frecuente', 'Cada 10 minutos', `${origin}/api/cron/frequent?key=TU_CLAVE`],
                  ].map(([id, when, url]) => (
                    <li key={id} className="flex items-center gap-2 p-2 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                      <span className="shrink-0 w-28 font-semibold text-[var(--text-primary)]">{when}</span>
                      <code className="flex-1 min-w-0 truncate text-[11px]">{url}</code>
                      <button type="button" onClick={() => copy(url, id)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" title="Copiar">
                        {copied === id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </li>
                  ))}
                </ul>
                <p>En cron-job.org elegí la zona horaria America/Argentina/Buenos_Aires.</p>
              </>
            )}
          </Step>

          <Step done={status.calendar} title="4. Google Calendar (opcional)">
            {status.calendar ? (
              <p>Sincronizando con {status.calendarId}.</p>
            ) : (
              <p>
                En Google Calendar: Configuración → tu calendario → Compartir con personas → agregá{' '}
                <code>{status.serviceAccountEmail || 'el correo de la cuenta de servicio'}</code> con permiso "Hacer cambios en los
                eventos". Después guardá tu Gmail en los Secrets como <code>GOOGLE_CALENDAR_ID</code>.
              </p>
            )}
          </Step>
        </ol>
      )}

      {status && (
        <div className="space-y-2 pt-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Probar</h3>
          <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
            {JOBS.map((j) => (
              <li key={j.id} className="flex items-center gap-2 p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{j.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{j.when}</p>
                </div>
                <button
                  type="button"
                  onClick={() => run(j.id, true)}
                  disabled={!status.serviceAccount || busy !== null}
                  className="px-2.5 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                >
                  {busy === `${j.id}-true` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => run(j.id, false)}
                  disabled={(j.id === 'calendar-sync' ? !status.calendar : !ready) || busy !== null}
                  className="px-2.5 py-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                >
                  {busy === `${j.id}-false` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {j.id === 'calendar-sync' ? 'Sincronizar' : 'Enviar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notice && <p className="text-sm text-[var(--text-primary)] p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)]">{notice}</p>}

      {preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Vista previa: {preview.title}</h3>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              Cerrar
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-sans">
            {preview.text}
          </pre>
        </div>
      )}
    </div>
  );
};
