import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, MessageCircle } from 'lucide-react';
import type { AgendaMeeting, AgendaTask, Project } from '../types';
import { buildNewClientProject, validateNewClient, type BillingMode, type NewClientForm, businessDaysAfter } from '../utils/newClient';
import { SERVICIOS, temaPorId } from '../portal/presencia';
import { tareasNuestras } from '../portal/presenciaAuto';

/** La reunión de arranque ya con su objetivo y preparación (del método) */
const ARRANQUE = (() => {
  const r = temaPorId('arranque').reunion!;
  return { tema: 'arranque' as const, objetivo: r.objetivo, ...(r.preparar ? { preparar: r.preparar } : {}), ...(r.conCM ? { conCM: true } : {}) };
})();
import { buildPedidoAlta, portalFromProject, type PafPortalDraft } from '../portal/model';
import { createPedidoAlta, publishPafPortal, suggestNextClienteId } from '../portal/store';
import { getTodayString } from '../utils/storage';

const field = 'w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]';
const label = 'block text-xs text-[var(--text-secondary)]';

interface Result {
  projectId: string;
  estudio: string;
  whatsapp: string;
  tally?: string;
  portal?: string;
  clienteId?: string;
  warnings: string[];
}

/**
 * NUEVO CLIENTE en una sola pantalla: tipo, datos, precio libre y primera reunión opcional.
 * Al crear un PAF: ficha + ID + link de Tally en un paso; el portal se publica solo si
 * Juan tilda la casilla. Al final, "Mandale esto" (lo manda Juan, el CRM no envía nada).
 */
export const NewClientView: React.FC<{
  initialTipo?: 'paf' | 'web';
  onAddProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAddMeeting: (m: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  /** Lo tuyo del Arranque va directo a tu agenda */
  onAddTask?: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onNavigate: (path: string) => void;
  onBack: () => void;
}> = ({ initialTipo = 'paf', onAddProject, onUpdateProject, onAddMeeting, onAddTask, onNavigate, onBack }) => {
  const [f, setF] = useState<NewClientForm>({
    tipo: initialTipo, plan: 'paf_pro', estudio: '', contacto: '', email: '', whatsapp: '',
    monto: 0, moneda: initialTipo === 'paf' ? 'USD' : 'ARS', modo: 'cuotas', primerCobro: getTodayString(), cuotas: 3, nota: '',
    alcance: ['contenido'],
  });
  const [montoText, setMontoText] = useState('');
  const [mesesText, setMesesText] = useState('');
  const [reunion, setReunion] = useState({ fecha: '', hora: '11:00' });
  const [publicar, setPublicar] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const isPaf = f.tipo === 'paf';
  const set = (patch: Partial<NewClientForm>) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (!isPaf) return;
    suggestNextClienteId(false).then(setClienteId).catch(() => setClienteId(''));
  }, [isPaf]);

  const create = async () => {
    const form: NewClientForm = { ...f, monto: Number(montoText.replace(/\./g, '').replace(',', '.')) || 0, meses: mesesText.trim() ? Number(mesesText) : undefined };
    const errs = validateNewClient(form);
    if (errs.length) { setErrors(errs); return; }
    setBusy(true); setErrors([]);
    const warnings: string[] = [];
    try {
      const data = buildNewClientProject(form);
      const hoy = new Date().toLocaleDateString('en-CA');
      if (isPaf && onAddTask && data.pafTemas?.arranque) data.pafTemas = { ...data.pafTemas, arranque: { ...data.pafTemas.arranque, agendado: hoy } };
      const projectId = await onAddProject(data);
      // Lo tuyo del Arranque (traspaso, Tally, preparar la reunión, "Hoy acordamos") a tu agenda
      if (isPaf && onAddTask) tareasNuestras(temaPorId('arranque'), { id: projectId, clientName: form.estudio.trim() }, hoy, hoy).forEach(onAddTask);
      const res: Result = { projectId, estudio: form.estudio.trim(), whatsapp: form.whatsapp.replace(/\D/g, ''), warnings };

      if (reunion.fecha) {
        onAddMeeting({ title: `${isPaf ? 'Reunión de arranque' : 'Reunión'} · ${form.estudio.trim()}`, date: reunion.fecha, time: reunion.hora || undefined, durationHours: isPaf ? 1.5 : 1, completed: false, projectId, projectName: form.estudio.trim(), ...(isPaf ? ARRANQUE : {}) });
      } else if (isPaf) {
        // Sin fecha: queda propuesta (no va a Calendar ni al portal hasta que le pongas día y hora)
        onAddMeeting({ title: `Reunión de arranque · ${form.estudio.trim()}`, date: businessDaysAfter(new Date().toLocaleDateString('en-CA'), 3), durationHours: 1.5, proposed: true, completed: false, projectId, projectName: form.estudio.trim(), ...ARRANQUE });
      }

      if (isPaf) {
        // ID y link de Tally en el mismo paso
        const pedido = buildPedidoAlta({ projectId, clienteId, estudio: form.estudio, contacto: form.contacto, email: form.email, zonaHoraria: 'America/Argentina/Buenos_Aires', prueba: false });
        if ('errors' in pedido) warnings.push(`El link de Tally no se creó: ${pedido.errors.join(' ')} Lo creás desde la ficha.`);
        else {
          try {
            await createPedidoAlta(pedido.pedido);
            res.tally = pedido.pedido.enlaceFormulario;
            res.clienteId = pedido.pedido.clienteId;
            const draft: PafPortalDraft = { emails: [form.email.trim().toLowerCase()], hito: 1, resumen: '', enlaces: {}, accesos: [] };
            let publishedAt: string | undefined;
            if (publicar) {
              const portal = portalFromProject({ id: projectId, clientName: form.estudio.trim(), pafClienteId: res.clienteId }, reunion.fecha ? [{ projectId, date: reunion.fecha, time: reunion.hora, completed: false }] : [], draft, res.clienteId);
              if ('doc' in portal) { await publishPafPortal(portal.doc); publishedAt = portal.doc.actualizadoEn; res.portal = `${window.location.origin}/portal`; }
              else warnings.push('El portal no se publicó. Lo publicás desde la ficha.');
            }
            onUpdateProject(projectId, { pafClienteId: res.clienteId, pafPortal: { ...draft, ...(publishedAt ? { publishedAt } : {}) } });
          } catch (err) {
            warnings.push((err as Error)?.message?.includes('ya se usó') ? (err as Error).message : 'El link de Tally no se creó por un problema de conexión. Lo creás desde la ficha.');
          }
        }
      }
      setResult(res);
    } catch {
      setErrors(['No se pudo crear el cliente. Revisá la conexión y probá de nuevo.']);
    } finally {
      setBusy(false);
    }
  };

  if (result) return <SendThis result={result} onOpen={() => onNavigate(`/clientes/${result.projectId}`)} />;

  const modos: { id: BillingMode; label: string }[] = [{ id: 'unico', label: 'Pago único' }, { id: 'cuotas', label: 'Cuotas' }, { id: 'mensual', label: 'Mensual' }];

  return (
    <div className="max-w-xl w-full mx-auto px-4 sm:px-6 pb-28 pt-2 space-y-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Volver" className="rounded-full p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Nuevo cliente</h1>
      </header>

      <Section title="Tipo">
        <Choice value={f.tipo} onChange={(tipo) => set({ tipo, moneda: tipo === 'paf' ? 'USD' : f.moneda })} options={[{ id: 'paf', label: 'PAF' }, { id: 'web', label: 'Web' }]} />
        {isPaf && <Choice value={f.plan} onChange={(plan) => set({ plan })} options={[{ id: 'paf_pro', label: 'PAF Pro' }, { id: 'paf_base', label: 'PAF Base' }]} />}
        {isPaf && (
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--text-secondary)]">Qué contrató además de la base (arranque, foco, mensaje y cierre)</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICIOS.map((s) => {
                const on = (f.alcance || []).includes(s.id);
                return (
                  <button key={s.id} type="button" aria-pressed={on} onClick={() => set({ alcance: on ? (f.alcance || []).filter((x) => x !== s.id) : [...(f.alcance || []), s.id] })}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? 'border-[var(--solid-contrast-bg)] bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
                    {on ? '✓ ' : '+ '}{s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Datos">
        <label className={label}>Estudio<input className={field} value={f.estudio} onChange={(e) => set({ estudio: e.target.value })} placeholder="Estudio Ejemplo Arquitectura" /></label>
        <label className={label}>Contacto<input className={field} value={f.contacto} onChange={(e) => set({ contacto: e.target.value })} placeholder="Nombre y apellido" /></label>
        <label className={label}>Correo{isPaf && ' (con este se comparte la carpeta y entra al portal)'}<input className={field} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="estudio@gmail.com" /></label>
        <label className={label}>WhatsApp<input className={field} inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+54 9 11 2345 6789" /></label>
      </Section>

      <Section title="Precio" hint="Libre: lo que acordaste con este cliente. Lo podés cambiar después en la ficha.">
        <div className="flex gap-2">
          <label className={`${label} flex-1`}>Monto<input className={field} inputMode="decimal" value={montoText} onChange={(e) => setMontoText(e.target.value)} placeholder="0" /></label>
          <label className={`${label} w-28`}>Moneda
            <select className={field} value={f.moneda} onChange={(e) => set({ moneda: e.target.value as 'USD' | 'ARS' })}><option value="USD">US$</option><option value="ARS">$ ARS</option></select>
          </label>
        </div>
        <Choice value={f.modo} onChange={(modo) => set({ modo })} options={modos} />
        <div className="flex flex-wrap gap-2">
          <label className={`${label} flex-1 min-w-[10rem]`}>{f.modo === 'unico' ? 'Fecha de cobro' : f.modo === 'cuotas' ? 'Primera cuota' : 'Primer mes (y día de cobro)'}
            <input className={field} type="date" value={f.primerCobro} onChange={(e) => set({ primerCobro: e.target.value })} />
          </label>
          {f.modo === 'cuotas' && <label className={`${label} w-24`}>Cuotas<input className={field} type="number" min={2} max={24} value={f.cuotas} onChange={(e) => set({ cuotas: Number(e.target.value) })} /></label>}
          {f.modo === 'mensual' && <label className={`${label} w-32`}>Meses<input className={field} type="number" min={1} max={60} value={mesesText} onChange={(e) => setMesesText(e.target.value)} placeholder="Sin fin" /></label>}
        </div>
        <label className={label}>Nota interna (opcional, no la ve el cliente)<input className={field} value={f.nota} onChange={(e) => set({ nota: e.target.value })} /></label>
      </Section>

      <Section title="Primera reunión" hint="Opcional. Queda en tu agenda y, si publicás el portal, el cliente la ve.">
        <div className="flex gap-2">
          <input className={`${field} flex-1`} type="date" aria-label="Fecha de la reunión" value={reunion.fecha} onChange={(e) => setReunion({ ...reunion, fecha: e.target.value })} />
          <input className={`${field} w-28`} type="time" aria-label="Hora de la reunión" value={reunion.hora} onChange={(e) => setReunion({ ...reunion, hora: e.target.value })} />
        </div>
      </Section>

      {isPaf && (
        <Section title="Alta">
          <p className="text-xs text-[var(--text-secondary)]">Se crea el ID <span className="font-mono text-[var(--text-primary)]">{clienteId || '…'}</span> y su link de Tally.</p>
          <label className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" className="mt-1" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
            <span>Publicar su portal ahora<span className="block text-xs text-[var(--text-tertiary)]">Entra con el correo de arriba. Si no, lo publicás después desde la ficha.</span></span>
          </label>
        </Section>
      )}

      {errors.length > 0 && <ul role="alert" className="space-y-1 text-sm text-rose-500">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      <button type="button" onClick={create} disabled={busy} className="btn-solid-primary w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}Crear cliente
      </button>
    </div>
  );
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-0.5" role="radiogroup">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm transition ${value === o.id ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Mandale esto": los links para el cliente, con Copiar y WhatsApp (lo envía Juan) */
function SendThis({ result: r, onOpen }: { result: Result; onOpen: () => void }) {
  const [copied, setCopied] = useState('');
  const lines = [
    r.tally && `Para arrancar, completá este formulario: ${r.tally}`,
    r.portal && `Tu portal (entrás con tu cuenta de Google): ${r.portal}`,
  ].filter(Boolean).join('\n');
  const message = `Hola! Bienvenido a .CERO.\n${lines}`;
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(''); } };

  return (
    <div className="max-w-xl w-full mx-auto px-4 sm:px-6 pb-28 pt-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] flex items-center justify-center"><Check className="w-4 h-4" /></span>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{r.estudio} ya está creado</h1>
          {r.clienteId && <p className="text-xs text-[var(--text-tertiary)] font-mono">{r.clienteId}</p>}
        </div>
      </div>

      {lines ? (
        <section className="card-swiss p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Mandale esto</h2>
          {r.tally && <LinkRow label="Formulario de Tally" url={r.tally} copied={copied === 'tally'} onCopy={() => copy(r.tally!, 'tally')} />}
          {r.portal && <LinkRow label="Su portal" url={r.portal} copied={copied === 'portal'} onCopy={() => copy(r.portal!, 'portal')} />}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => copy(message, 'todo')} className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"><Copy className="w-4 h-4" />{copied === 'todo' ? 'Mensaje copiado' : 'Copiar mensaje'}</button>
            {r.whatsapp && <a href={`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"><MessageCircle className="w-4 h-4" />Abrir WhatsApp</a>}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">El CRM no le manda nada: lo enviás vos.</p>
        </section>
      ) : <p className="text-sm text-[var(--text-secondary)]">No hay nada para mandarle todavía.</p>}

      {r.warnings.length > 0 && <ul className="space-y-1 text-sm text-amber-600">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      {r.clienteId && (
        <section className="card-swiss p-5 space-y-1.5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ya le dejamos el arranque cargado</h2>
          <p className="text-sm text-[var(--text-secondary)]">Las 3 tareas de la etapa 1 (ocultas), un anuncio de bienvenida (sin publicar) y la reunión de arranque. Revisalos en su ficha y habilitalos cuando quieras: hasta entonces, el cliente no los ve.</p>
        </section>
      )}

      <button type="button" onClick={onOpen} className="btn-solid-primary w-full px-4 py-3 text-sm">Ir a la ficha</button>
    </div>
  );
}

function LinkRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
        <p className="truncate font-mono text-xs text-[var(--text-primary)]">{url}</p>
      </div>
      <button type="button" onClick={onCopy} className="shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]">{copied ? 'Copiado' : 'Copiar'}</button>
    </div>
  );
}
