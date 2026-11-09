import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, FolderOpen, Loader2, MessageCircle, UserPlus } from 'lucide-react';
import { Project } from '../types';
import { buildPedidoAlta, safeHttpsUrl, type PafDriveLinks, type PafPedidoAlta } from '../portal/model';
import { createPedidoAlta, subscribePedidoDeProyecto, suggestNextClienteId } from '../portal/store';
import { hapticFeedback } from '../utils/haptics';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const ESTADO_LABEL: Record<PafPedidoAlta['estado'], string> = {
  pendiente: 'Link listo. La Sheet lo registra en los próximos minutos.',
  registrado: 'Registrado en la Sheet.',
  error: 'La Sheet no pudo registrarlo.',
};
const DRIVE_FIELDS: { key: 'carpetaCompartida' | 'carpetaInterna' | 'ficha'; label: string; hint: string }[] = [
  { key: 'carpetaCompartida', label: 'Carpeta del estudio', hint: 'compartida' },
  { key: 'carpetaInterna', label: 'Carpeta interna', hint: 'solo vos' },
  { key: 'ficha', label: 'Ficha', hint: 'solo vos' },
];

/**
 * En la ficha PAF: el alta del estudio.
 * 1. "Crear link de Tally": el CRM asigna el ID (PAF-002…) y te da el link al instante.
 * 2. Lo mandás vos (copiar o WhatsApp). El CRM no le manda nada solo.
 * 3. Las carpetas de Drive: las trae el script cuando el estudio responde, o las pegás a mano.
 */
export const PafAltaCard: React.FC<{ project: Project; onUpdateProject: (id: string, updates: Partial<Project>) => void }> = ({ project, onUpdateProject }) => {
  const [pedido, setPedido] = useState<PafPedidoAlta | null | undefined>(undefined);
  const [form, setForm] = useState({
    clienteId: '',
    estudio: project.clientName,
    contacto: project.ownerName || '',
    email: project.clientEmail || '',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    prueba: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [drive, setDrive] = useState<PafDriveLinks>(project.pafDrive || {});

  useEffect(() => subscribePedidoDeProyecto(project.id, setPedido), [project.id]);

  // El ID del alta queda en la ficha (lo usa el portal)
  useEffect(() => {
    if (pedido?.clienteId && !project.pafClienteId) onUpdateProject(project.id, { pafClienteId: pedido.clienteId });
  }, [pedido?.clienteId, project.id, project.pafClienteId, onUpdateProject]);

  // Propone el próximo ID libre (se puede cambiar a mano)
  // Un pedido viejo sin ID (de antes del link al instante) se completa con el formulario
  const legacy = pedido && !pedido.clienteId ? pedido : null;
  const formOpen = pedido === null || !!legacy || showForm;
  useEffect(() => {
    if (legacy) setForm((f) => ({ ...f, estudio: legacy.estudio, contacto: legacy.contacto, email: legacy.email, zonaHoraria: legacy.zonaHoraria, prueba: legacy.prueba }));
  }, [legacy?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!formOpen) return;
    let alive = true;
    suggestNextClienteId(form.prueba).then((id) => alive && setForm((f) => ({ ...f, clienteId: id }))).catch(() => undefined);
    return () => { alive = false; };
  }, [formOpen, form.prueba]);

  const create = async () => {
    hapticFeedback.light();
    const r = buildPedidoAlta({ projectId: project.id, ...form });
    if ('errors' in r) { setErrors(r.errors); return; }
    setBusy(true); setErrors([]); setNotice('');
    try {
      await createPedidoAlta(r.pedido, legacy?.id);
      onUpdateProject(project.id, { pafClienteId: r.pedido.clienteId, ...(project.clientEmail ? {} : { clientEmail: r.pedido.email }) });
      setShowForm(false);
    } catch (err) {
      setErrors([(err as Error)?.message?.includes('ya se usó') ? (err as Error).message : 'No se pudo crear. Revisá la conexión y reintentá.']);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice('Link copiado. Mandáselo por tu canal.'); } catch { setNotice(text); }
  };

  const saveDrive = () => {
    const clean: PafDriveLinks = {};
    for (const { key, label } of DRIVE_FIELDS) {
      const raw = drive[key]?.trim();
      if (!raw) continue;
      const url = safeHttpsUrl(raw);
      if (!url) { setErrors([`"${label}" tiene que ser un link https://`]); return; }
      clean[key] = url;
    }
    setErrors([]);
    // Solo cambia las tres que se editan acá: las partes que trajo el alta se conservan
    const { carpetaCompartida: _c, carpetaInterna: _i, ficha: _f, ...resto } = project.pafDrive || {};
    onUpdateProject(project.id, { pafDrive: { ...resto, ...clean } });
    setNotice('Carpetas guardadas. "Carpeta del estudio" se usa en su portal.');
  };

  if (pedido === undefined) return null;
  const alta = pedido?.alta;
  const phone = (project.clientPhone || '').replace(/\D/g, '');
  const waText = pedido?.enlaceFormulario
    ? `Hola${form.contacto ? ` ${form.contacto.split(' ')[0]}` : ''}! Para arrancar con el Método PAF, completá este formulario así nos organizamos: ${pedido.enlaceFormulario}`
    : '';
  const scriptLinks = alta && (alta.carpetaCompartida || alta.carpetaInterna || alta.ficha);

  return (
    <div className="space-y-2.5 pt-3 border-t border-zinc-800">
      <div className="flex items-center gap-2">
        <UserPlus className="w-3.5 h-3.5 text-amber-400" />
        <h3 className="text-xs font-bold text-zinc-100 flex-1">Alta del estudio</h3>
        {pedido?.clienteId && <span className="text-[10px] font-mono text-zinc-400">{pedido.clienteId}{pedido.prueba ? ' · prueba' : ''}</span>}
      </div>

      {pedido && !formOpen && (
        <div className="space-y-2">
          {pedido.enlaceFormulario && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Link del formulario de Tally</p>
              <p className="text-[11px] font-mono text-zinc-200 break-all">{pedido.enlaceFormulario}</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => copy(pedido.enlaceFormulario!)} className="inline-flex items-center gap-1 rounded-lg bg-amber-400 text-zinc-950 px-2.5 py-1 text-[11px] font-bold"><Copy className="w-3 h-3" />Copiar link</button>
                {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 text-emerald-300 px-2.5 py-1 text-[11px] font-bold"><MessageCircle className="w-3 h-3" />Abrir WhatsApp</a>}
                <a href={pedido.enlaceFormulario} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 text-zinc-300 px-2.5 py-1 text-[11px] font-bold"><ExternalLink className="w-3 h-3" />Ver formulario</a>
              </div>
            </div>
          )}
          <p className={`text-[11px] ${pedido.estado === 'error' ? 'text-rose-300' : 'text-zinc-400'}`}>{ESTADO_LABEL[pedido.estado]}{alta?.estado ? ` · ${alta.estado}` : ''}</p>
          {(pedido.error || alta?.error) && <p role="alert" className="text-[11px] text-rose-300">{pedido.error || alta?.error}</p>}
          {alta?.fechaRespuesta && <p className="text-[11px] text-emerald-300">Respondió el formulario el {alta.fechaRespuesta.slice(0, 10)}</p>}
          {pedido.estado === 'error' && <button type="button" onClick={() => setShowForm(true)} className="text-[11px] font-bold text-amber-300">Corregir y crear de nuevo</button>}
        </div>
      )}

      {formOpen && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-zinc-400">Te da el link de Tally para mandarle al estudio. Cuando responda, se crean sus carpetas de Drive.</p>
          <label className="flex items-center gap-2 text-[11px] text-zinc-400"><input type="checkbox" checked={form.prueba} onChange={(e) => setForm({ ...form, prueba: e.target.checked })} /> Es una prueba</label>
          <label className="block text-[11px] text-zinc-400">ID del cliente (no se reutiliza nunca)<input className={`${input} font-mono`} value={form.clienteId} placeholder={form.prueba ? 'PAF-PRUEBA-002' : 'PAF-002'} onChange={(e) => setForm({ ...form, clienteId: e.target.value.toUpperCase() })} /></label>
          <label className="block text-[11px] text-zinc-400">Estudio<input className={input} value={form.estudio} onChange={(e) => setForm({ ...form, estudio: e.target.value })} /></label>
          <label className="block text-[11px] text-zinc-400">Correo (con el que se comparte la carpeta)<input className={input} type="email" value={form.email} placeholder="estudio@gmail.com" onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="block text-[11px] text-zinc-400">Contacto (opcional)<input className={input} value={form.contacto} placeholder="Nombre y apellido" onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></label>
          <label className="block text-[11px] text-zinc-400">Zona horaria<input className={input} value={form.zonaHoraria} onChange={(e) => setForm({ ...form, zonaHoraria: e.target.value })} /></label>
          <div className="flex gap-2">
            <button type="button" onClick={create} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-zinc-950 px-3 py-1.5 text-xs font-bold disabled:opacity-60">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Crear link de Tally
            </button>
            {showForm && <button type="button" onClick={() => setShowForm(false)} className="text-xs text-zinc-400">Cancelar</button>}
          </div>
        </div>
      )}

      {pedido && !formOpen && (
        <div className="space-y-1.5 pt-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-200"><FolderOpen className="w-3.5 h-3.5 text-sky-400" />Carpetas de Drive</p>
          {scriptLinks ? (
            <div className="grid gap-1.5">
              {DRIVE_FIELDS.map(({ key, label, hint }) => alta?.[key] && (
                <a key={key} href={alta[key]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200">
                  <span>{label} <span className="font-normal text-zinc-500">({hint})</span></span><ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              ))}
            </div>
          ) : (
            <>
              <p className="text-[11px] text-zinc-500">Aparecen solas cuando el estudio responde el formulario. Si ya las tenés, pegalas acá.</p>
              {DRIVE_FIELDS.map(({ key, label, hint }) => (
                <label key={key} className="block text-[11px] text-zinc-400">{label} <span className="text-zinc-600">({hint})</span>
                  <input className={input} value={drive[key] || ''} placeholder="https://drive.google.com/…" onChange={(e) => setDrive({ ...drive, [key]: e.target.value })} />
                </label>
              ))}
              <button type="button" onClick={saveDrive} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">Guardar carpetas</button>
            </>
          )}
        </div>
      )}

      {errors.length > 0 && <ul role="alert" className="text-[11px] text-rose-300">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {notice && <p role="status" className="text-[11px] text-emerald-300">{notice}</p>}
    </div>
  );
};
