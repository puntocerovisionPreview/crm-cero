import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, CloudDownload, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { getAuthHeaders } from '../utils/authAccess';

/**
 * ESTADO DE LA APP: todo lo que corre solo, en verde o rojo.
 * Integraciones conectadas, cuándo corrió cada automatización, el último respaldo y los
 * errores de los últimos 14 días. Si está todo verde, no hay que tocar nada.
 */

interface Health {
  dbAccess: boolean;
  integrations: Record<string, { configured: boolean; label: string; hint?: string }>;
  jobs: Record<string, { lastRunAt: string; ok: boolean; detail?: string }>;
  backup: { lastAt?: string; path?: string; docs?: number; bytes?: number; ok?: boolean; error?: string | null; failedAt?: string } | null;
  errors: { id: string; source: string; message: string; path?: string; count: number; lastAt: string; seen: boolean }[];
}

const JOB_LABELS: Record<string, string> = {
  'receta-web': 'Preparación de proyectos Web',
  reminders: 'Avisos (cada 10 min)',
  'calendar-sync': 'Google Calendar (cada 10 min)',
  mercadopago: 'Mercado Pago (cada 10 min)',
  'daily-brief': 'Resumen del día',
  weekly: 'Plan de la semana',
  'prospecting-close': 'Cierre de prospección',
  'day-close': 'Recordatorio de cerrar el día',
  'weekly-collections': 'Cobranza de la semana',
  'paf-report': 'Reporte de alumnos PAF',
  'month-close': 'Cierre de mes',
  backup: 'Respaldo semanal',
};

// Cada cuánto debería correr (horas): si pasó mucho más, el reloj no está andando
const EXPECTED_HOURS: Record<string, number> = { reminders: 2, 'calendar-sync': 2, mercadopago: 2, 'daily-brief': 30, backup: 8 * 24 };

function ago(iso?: string): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

async function call<T>(path: string, method = 'GET'): Promise<T> {
  const r = await fetch(path, { method, headers: await getAuthHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
  return data as T;
}

export const AppHealthPanel: React.FC = () => {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    try {
      setH(await call<Health>('/api/health/status'));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMsg(null);
    try {
      setMsg(await fn());
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (err) {
    return (
      <div className="card-swiss p-4 space-y-2">
        <p className="text-sm text-[var(--semantic-red)]">No se pudo leer el estado: {err}</p>
        <button type="button" onClick={load} className="text-sm font-semibold text-[var(--accent)]">
          Reintentar
        </button>
      </div>
    );
  }
  if (!h) {
    return (
      <p className="text-sm text-[var(--text-tertiary)] flex items-center gap-2 p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Revisando…
      </p>
    );
  }

  const jobs = Object.entries(h.jobs).sort((a, b) => b[1].lastRunAt.localeCompare(a[1].lastRunAt));
  const stale = (job: string, at: string) => EXPECTED_HOURS[job] !== undefined && Date.now() - Date.parse(at) > EXPECTED_HOURS[job] * 3600 * 1000;
  const clockStopped = !!h.jobs.reminders && stale('reminders', h.jobs.reminders.lastRunAt);
  const backupOld = !h.backup?.lastAt || Date.now() - Date.parse(h.backup.lastAt) > 8 * 24 * 3600 * 1000;
  const newErrors = h.errors.filter((e) => !e.seen);
  const problems = [
    !h.dbAccess || !h.integrations.base?.configured ? 'El servidor no tiene acceso a la base' : '',
    !h.integrations.reloj?.configured ? 'Falta configurar el reloj de automatizaciones' : '',
    clockStopped ? 'Las automatizaciones dejaron de correr' : '',
    jobs.some(([, j]) => !j.ok) ? 'Alguna automatización falló la última vez' : '',
    backupOld ? 'No hay un respaldo reciente' : '',
    newErrors.length ? `${newErrors.length} ${newErrors.length === 1 ? 'error nuevo' : 'errores nuevos'}` : '',
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className={`card-swiss p-4 flex items-start gap-3 ${problems.length ? 'border-[var(--semantic-amber)]/50' : ''}`}>
        {problems.length ? <AlertTriangle className="w-5 h-5 text-[var(--semantic-amber)] shrink-0" /> : <ShieldCheck className="w-5 h-5 text-[var(--semantic-green)] shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{problems.length ? `${problems.length} ${problems.length === 1 ? 'cosa para revisar' : 'cosas para revisar'}` : 'Todo en orden'}</p>
          {problems.length > 0 ? (
            <ul className="text-xs text-[var(--text-secondary)] list-disc pl-4 mt-1 space-y-0.5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Las automatizaciones corren, hay respaldo y no hubo errores. No hace falta tocar nada.</p>
          )}
        </div>
        <button type="button" onClick={load} aria-label="Actualizar" className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <section className="card-swiss p-4 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Conexiones</h3>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {Object.entries(h.integrations).map(([k, v]) => {
            const critical = k === 'base' || k === 'reloj';
            return (
              <li key={k} className="py-2 flex items-start gap-2">
                {v.configured ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--semantic-green)] shrink-0 mt-0.5" />
                ) : critical ? (
                  <XCircle className="w-4 h-4 text-[var(--semantic-red)] shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[var(--text-primary)]">{v.label}</span>
                  {!v.configured && v.hint && <span className="block text-[11px] text-[var(--text-tertiary)]">{critical ? '' : 'Opcional. '}{v.hint}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-swiss p-4 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Automatizaciones</h3>
        {jobs.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">Todavía no corrió ninguna. Revisá el reloj en Automatizaciones (guía de cron-job.org).</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {jobs.map(([job, j]) => {
              const late = stale(job, j.lastRunAt);
              return (
                <li key={job} className="py-2 flex items-start gap-2">
                  {!j.ok ? (
                    <XCircle className="w-4 h-4 text-[var(--semantic-red)] shrink-0 mt-0.5" />
                  ) : late ? (
                    <AlertTriangle className="w-4 h-4 text-[var(--semantic-amber)] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[var(--semantic-green)] shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-[var(--text-primary)]">{JOB_LABELS[job] || job}</span>
                    <span className="block text-[11px] text-[var(--text-tertiary)] break-words">
                      {ago(j.lastRunAt)}
                      {late ? ' · debería haber corrido antes' : ''}
                      {j.detail ? ` · ${j.detail}` : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card-swiss p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Respaldo</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Se hace solo una vez por semana (se guardan los últimos 8).{' '}
            {h.backup?.lastAt
              ? `Último: ${ago(h.backup.lastAt)}${h.backup.docs ? `, ${h.backup.docs.toLocaleString('es-AR')} registros` : ''}.`
              : 'Todavía no hay ninguno.'}
            {h.backup?.ok === false && h.backup.error ? ` Último intento falló: ${h.backup.error}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => act('backup', async () => {
              const r = await call<{ docs: number }>('/api/health/backup', 'POST');
              return `Respaldo hecho: ${r.docs.toLocaleString('es-AR')} registros.`;
            })}
            className="px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold bg-[var(--accent)] text-[var(--on-accent)] flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Hacer respaldo ahora
          </button>
          {h.backup?.lastAt && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act('download', async () => {
                const r = await call<{ url: string; name: string }>('/api/health/backup/latest');
                window.open(r.url, '_blank', 'noopener');
                return `Descargando ${r.name}.`;
              })}
              className="px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center gap-1.5 disabled:opacity-50"
            >
              <CloudDownload className="w-4 h-4" /> Descargar el último
            </button>
          )}
        </div>
      </section>

      <section className="card-swiss p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex-1">Errores (últimos 14 días)</h3>
          {newErrors.length > 0 && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act('seen', async () => {
                await call('/api/health/errors/seen', 'POST');
                return 'Marcados como vistos.';
              })}
              className="text-xs font-semibold text-[var(--accent)]"
            >
              Marcar como vistos
            </button>
          )}
        </div>
        {h.errors.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">Ninguno. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {h.errors.map((e) => (
              <li key={e.id} className={`p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] text-xs ${e.seen ? 'opacity-60' : ''}`}>
                <p className="text-[var(--text-primary)] break-words">{e.message}</p>
                <p className="text-[var(--text-tertiary)]">
                  {e.source}
                  {e.path ? ` · ${e.path}` : ''} · {ago(e.lastAt)}
                  {e.count > 1 ? ` · ${e.count} veces` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {msg && <p className="text-sm text-[var(--text-secondary)]">{msg}</p>}
    </div>
  );
};
