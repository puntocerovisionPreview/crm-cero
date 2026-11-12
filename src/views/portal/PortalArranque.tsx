import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { PREGUNTAS_ARRANQUE, limpiarRespuestas, type RespuestasArranque } from '../../portal/arranque';
import { sendArranque } from '../../portal/store';

/**
 * ALTA SIN TALLY, del lado del estudio: "Completá tus datos" es lo primero que ve.
 * Lo que escribe se guarda en su dispositivo (si cierra, no lo pierde). Al mandar, el CRM
 * guarda sus datos y crea sus carpetas; el portal pasa solo a "Tus materiales".
 */
export function ArranqueForm({ clienteId, estudio, email, readOnly }: { clienteId: string; estudio: string; email: string; readOnly?: boolean }) {
  const key = `paf_arranque_${clienteId}`;
  const [r, setR] = useState<RespuestasArranque>(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(key) || 'null');
      if (guardado && typeof guardado === 'object') return guardado;
    } catch { /* sin almacenamiento */ }
    return { estudio, emailCarpeta: email.includes('@') ? email : '' };
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(r)); } catch { /* sin almacenamiento */ }
  }, [key, r]);

  const set = (id: string, v: string | string[]) => { setR((x) => ({ ...x, [id]: v })); setError(''); };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const { respuestas, errores } = limpiarRespuestas(r);
    if (errores.length) { setError(errores.join(' ')); return; }
    setEnviando(true); setError('');
    const err = await sendArranque(clienteId, respuestas);
    setEnviando(false);
    if (err) { setError(err); return; }
    setEnviado(true);
    try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
  };

  if (enviado) return <ArranqueCreando />;

  const campo = 'mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--marca)] focus:outline-none';
  return (
    <section aria-label="Completá tus datos" className="rounded-[28px] border border-[var(--border-subtle)] bg-white p-5 shadow-sm sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--marca)]">Ahora</p>
      <span className="mt-3 inline-flex rounded-full bg-[var(--marca)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--marca-text)]">Te toca a vos</span>
      <h2 className="mt-2 text-2xl font-normal leading-tight tracking-tight text-[var(--text-primary)] sm:text-[30px]">Completá tus datos</h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">Son unos minutos. Con esto preparamos tu carpeta de trabajo y nuestra primera reunión. Si un dato no lo sabés, poné “lo vemos en la reunión”.</p>
      <form onSubmit={enviar} className="mt-6 space-y-5">
        {PREGUNTAS_ARRANQUE.map((p) => (
          <div key={p.id}>
            <label htmlFor={`arr-${p.id}`} className="block text-sm font-medium text-[var(--text-primary)]">{p.label}{p.requerida && <span className="text-[var(--marca)]"> *</span>}</label>
            {p.ayuda && <p className="text-xs text-[var(--text-tertiary)]">{p.ayuda}</p>}
            {p.tipo === 'opciones' ? (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={`arr-${p.id}`}>
                {p.opciones!.map((o) => {
                  const lista = (r[p.id] as string[]) || [];
                  const on = lista.includes(o);
                  return (
                    <button key={o} type="button" aria-pressed={on} onClick={() => set(p.id, on ? lista.filter((x) => x !== o) : [...lista, o])}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? 'border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-text)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
                      {on && <Check className="mr-1 inline h-3.5 w-3.5" />}{o}
                    </button>
                  );
                })}
              </div>
            ) : p.tipo === 'largo' ? (
              <textarea id={`arr-${p.id}`} rows={3} className={campo} value={String(r[p.id] || '')} onChange={(e) => set(p.id, e.target.value)} />
            ) : (
              <input id={`arr-${p.id}`} className={campo} value={String(r[p.id] || '')} onChange={(e) => set(p.id, e.target.value)}
                type={p.tipo === 'email' ? 'email' : p.tipo === 'tel' ? 'tel' : 'text'} inputMode={p.tipo === 'tel' ? 'tel' : undefined} autoComplete={p.tipo === 'email' ? 'email' : p.tipo === 'tel' ? 'tel' : 'off'} />
            )}
          </div>
        ))}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={enviando || readOnly} title={readOnly ? 'Vista previa: el botón no hace nada' : undefined}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--marca)] px-6 py-3 text-[15px] font-medium text-[var(--marca-text)] disabled:opacity-60">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{enviando ? 'Guardando y preparando tu carpeta…' : 'Enviar mis datos'}
        </button>
        <p className="text-xs text-[var(--text-tertiary)]">Lo que escribís se guarda en este dispositivo hasta que lo mandes.</p>
      </form>
    </section>
  );
}

/** Mientras el CRM crea sus carpetas (son unos segundos; el portal se actualiza solo) */
export function ArranqueCreando() {
  return (
    <section aria-live="polite" className="rounded-[28px] border border-[var(--border-subtle)] bg-white p-5 shadow-sm sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--marca)]">Ahora</p>
      <h2 className="mt-3 flex items-center gap-3 text-2xl font-normal leading-tight tracking-tight text-[var(--text-primary)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--marca)]" />Estamos preparando tu carpeta</h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">Ya recibimos tus datos, gracias. En un ratito te aparece acá lo que sigue: dónde subir tus materiales. No hace falta que hagas nada más.</p>
    </section>
  );
}
