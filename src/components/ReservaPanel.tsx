import React, { useMemo, useState } from 'react';
import { Check, Database, Download, Loader2, Upload } from 'lucide-react';
import { Project, Prospect, ProspectingSettings } from '../types';
import { COUNTRY_NAMES, PoolLead, PoolReport, PoolSegment, buildPool, parseCsv, pickBatch, poolToCsv } from '../prospecting/pool';
import { TAKE_REASON_TEXT, addToPool, takeFromPool } from '../prospecting/poolStore';
import { friendlyError } from '../prospecting/actions';
import { saveProspectingSettings } from '../prospecting/store';
import { phoneKey } from '../prospecting/core';

const card = 'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';
const btn = 'px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const btnGhost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;

const SEGMENTS: { id: PoolSegment; label: string }[] = [
  { id: 'arquitectura', label: 'Arquitectura' },
  { id: 'interiorismo', label: 'Interiorismo' },
  { id: 'paisajismo', label: 'Paisajismo' },
  { id: 'construccion', label: 'Construcción' },
];

interface Props {
  available: PoolLead[];
  takenCount: number;
  loading: boolean;
  prospects: Prospect[];
  projects: Project[];
  settings: ProspectingSettings;
  today: string;
  onChanged: () => void;
}

// Reserva: la base grande (del scraper). Cada semana pasan los mejores a prospección.
export const ReservaPanel: React.FC<Props> = ({ available, takenCount, loading, prospects, projects, settings, today, onChanged }) => {
  const [report, setReport] = useState<PoolReport | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(settings.weeklyBatchSize);
  const [countries, setCountries] = useState<string[]>(settings.poolCountries || []);
  const [segments, setSegments] = useState<string[]>(settings.poolSegments || []);

  const countriesInPool = useMemo(() => {
    const m: Record<string, number> = {};
    available.forEach((l) => (m[l.country] = (m[l.country] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [available]);

  const next = useMemo(
    () => pickBatch(available, Math.max(1, batchSize), { countries, segments: segments as PoolSegment[] }),
    [available, batchSize, countries, segments]
  );

  const onFile = async (file: File) => {
    setNotice(null);
    setFileName(file.name);
    const text = await file.text();
    // No sumar a quien ya está en prospección o ya es cliente
    const excludePhones = new Set<string>();
    prospects.forEach((p) => phoneKey(p.whatsapp) && excludePhones.add(phoneKey(p.whatsapp)));
    projects.forEach((p) => phoneKey(p.clientPhone) && excludePhones.add(phoneKey(p.clientPhone)));
    setReport(buildPool(parseCsv(text), { excludePhones }));
  };

  const add = async () => {
    if (!report) return;
    setBusy('add');
    try {
      const n = await addToPool(report.accepted, today);
      setNotice(n === report.accepted.length ? `Listo: sumaste ${n} contactos a la reserva.` : `Sumaste ${n} nuevos (${report.accepted.length - n} ya estaban en la reserva).`);
      setReport(null);
      onChanged();
    } catch (err) {
      setNotice(`No se pudo guardar en la reserva: ${friendlyError(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const saveConfig = async () => {
    setBusy('save');
    try {
      await saveProspectingSettings({ ...settings, weeklyBatchSize: batchSize, poolCountries: countries, poolSegments: segments });
      setNotice('Configuración guardada.');
    } catch (err) {
      setNotice(`No se pudo guardar: ${friendlyError(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const takeNow = async () => {
    setBusy('take');
    try {
      const res = await takeFromPool(batchSize, { ...settings, poolCountries: countries, poolSegments: segments }, today);
      setNotice(res.added ? `Pasaron ${res.added} contactos a prospección, repartidos en tus días de trabajo.` : res.reason ? TAKE_REASON_TEXT[res.reason] : 'No se sumó ningún contacto.');
      onChanged();
    } catch (err) {
      setNotice(`No se pudo pasar la tanda: ${friendlyError(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const download = () => {
    const blob = new Blob([poolToCsv(available)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reserva-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium border transition ${on ? 'bg-[var(--accent)] text-[var(--on-accent)] border-transparent' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;

  return (
    <div className="space-y-4">
      <section className={`${card} p-4 flex items-center gap-4 flex-wrap`}>
        <Database className="w-6 h-6 text-[var(--accent)]" />
        <div className="flex-1 min-w-[180px]">
          <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{loading ? '…' : available.length.toLocaleString('es-AR')}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            contactos disponibles en la reserva{takenCount > 0 ? ` — ya pasaron ${takenCount} a prospección` : ''}
          </p>
        </div>
        {available.length > 0 && (
          <button type="button" className={btnGhost} onClick={download}>
            <Download className="w-4 h-4" /> Descargar (Excel)
          </button>
        )}
      </section>

      {notice && <p className="text-sm text-[var(--text-primary)] p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)]">{notice}</p>}

      <section className={`${card} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Subir la base del scraper</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Subí el CSV de Google Maps (por ejemplo <code>arquitectura_latam_combinado.csv</code>). La app limpia los datos, descarta lo que no sirve
            (sin teléfono, cerrados, fuera del nicho, Brasil, repetidos, gente que ya contactaste) y le pone un puntaje a cada contacto.
          </p>
        </div>
        <label className={`${btnGhost} w-fit cursor-pointer`}>
          <Upload className="w-4 h-4" /> Elegir archivo CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>

        {report && (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-[var(--text-primary)]">
              <b>{fileName}</b>: {report.total.toLocaleString('es-AR')} filas, <b>{report.accepted.length.toLocaleString('es-AR')}</b> sirven.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['A', 'B', 'C'] as const).map((t) => (
                <div key={t} className="p-2 rounded-[var(--radius-control)] bg-[var(--bg-app)]">
                  <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{report.accepted.filter((l) => l.tier === t).length}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{t === 'A' ? 'Prioridad A (los mejores)' : t === 'B' ? 'Prioridad B' : 'Prioridad C'}</p>
                </div>
              ))}
            </div>
            {Object.keys(report.rejected).length > 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">
                Descartados: {Object.entries(report.rejected).map(([k, v]) => `${k} (${v})`).join(', ')}.
              </p>
            )}
            <button type="button" className={btnPrimary} disabled={busy !== null || report.accepted.length === 0} onClick={add}>
              {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Sumar {report.accepted.length.toLocaleString('es-AR')} a la reserva
            </button>
          </div>
        )}
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Tanda semanal automática</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            La primera vez que abrís la app cada semana pasan los mejores contactos de la reserva a prospección, con los primeros mensajes repartidos en los días hábiles.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          Contactos por semana
          <input
            type="number"
            min={0}
            max={100}
            value={batchSize}
            onChange={(e) => setBatchSize(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
            className="w-20 px-2 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm"
          />
          <span className="text-xs text-[var(--text-tertiary)]">(0 = no automático)</span>
        </label>

        {countriesInPool.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Países (ninguno marcado = todos)</p>
            <div className="flex flex-wrap gap-1.5">
              {countriesInPool.map(([code, n]) => (
                <button key={code} type="button" aria-pressed={countries.includes(code)} className={chip(countries.includes(code))} onClick={() => toggle(countries, setCountries, code)}>
                  {COUNTRY_NAMES[code] || code} <span className="tabular-nums">{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Rubros (ninguno marcado = todos)</p>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map((s) => (
              <button key={s.id} type="button" aria-pressed={segments.includes(s.id)} className={chip(segments.includes(s.id))} onClick={() => toggle(segments, setSegments, s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={busy !== null} onClick={saveConfig}>
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
          </button>
          <button type="button" className={btnGhost} disabled={busy !== null || available.length === 0 || batchSize === 0} onClick={takeNow}>
            {busy === 'take' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Tomar una tanda ahora
          </button>
        </div>
      </section>

      {next.length > 0 && (
        <section className={`${card} p-4 space-y-2`}>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Próximos en salir ({next.length})</h3>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {next.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2">
                <span className={`w-7 text-center text-xs font-bold ${l.tier === 'A' ? 'text-emerald-400' : l.tier === 'B' ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}`}>{l.score}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{l.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">
                    {l.city}, {l.countryName} — {l.reasons.slice(1).join(', ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
