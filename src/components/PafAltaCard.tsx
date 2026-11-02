import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, UserPlus } from 'lucide-react';
import { Project } from '../types';
import { buildPedidoAlta, type PafPedidoAlta } from '../portal/model';
import { createPedidoAlta, subscribePedidoDeProyecto } from '../portal/store';
import { hapticFeedback } from '../utils/haptics';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const ESTADO_LABEL: Record<PafPedidoAlta['estado'], string> = {
  pendiente: 'Pedido enviado: el script lo toma en los próximos 5 minutos',
  registrado: 'Registrado en la Sheet',
  error: 'El script no pudo registrarlo',
};

/**
 * En la ficha PAF: pedir el alta del estudio sin abrir la Sheet. Crea un pedido en
 * paf_pedidos_alta; el Apps Script lo registra y devuelve ID, enlace de Tally y carpetas.
 * El CRM no le manda nada al estudio: el enlace lo pasa Juan.
 */
export const PafAltaCard: React.FC<{ project: Project; onUpdateProject: (id: string, updates: Partial<Project>) => void }> = ({ project, onUpdateProject }) => {
  const [pedido, setPedido] = useState<PafPedidoAlta | null | undefined>(undefined);
  const [form, setForm] = useState({
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

  useEffect(() => subscribePedidoDeProyecto(project.id, setPedido), [project.id]);

  // El ID que asigna el script queda en la ficha (lo usa el portal)
  useEffect(() => {
    if (pedido?.clienteId && !project.pafClienteId) onUpdateProject(project.id, { pafClienteId: pedido.clienteId });
  }, [pedido?.clienteId, project.id, project.pafClienteId, onUpdateProject]);

  const send = async () => {
    hapticFeedback.light();
    const r = buildPedidoAlta({ projectId: project.id, ...form });
    if ('errors' in r) { setErrors(r.errors); return; }
    setBusy(true); setErrors([]);
    try {
      await createPedidoAlta(r.pedido);
      setShowForm(false);
    } catch {
      setErrors(['No se pudo enviar el pedido. Revisá la conexión y reintentá.']);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice('Copiado.'); } catch { setNotice(text); }
  };

  if (pedido === undefined) return null;
  const alta = pedido?.alta;
  const link = (label: string, url?: string, hint?: string) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200">
        <span>{label}{hint && <span className="ml-1 font-normal text-zinc-500">{hint}</span>}</span><ExternalLink className="w-3 h-3 text-zinc-500" />
      </a>
    ) : null;

  return (
    <div className="space-y-2.5 pt-3 border-t border-zinc-800">
      <div className="flex items-center gap-2">
        <UserPlus className="w-3.5 h-3.5 text-amber-400" />
        <h3 className="text-xs font-bold text-zinc-100 flex-1">Alta del estudio</h3>
        {pedido?.clienteId && <span className="text-[10px] font-mono text-zinc-400">{pedido.clienteId}{pedido.prueba ? ' · prueba' : ''}</span>}
      </div>

      {pedido && !showForm && (
        <div className="space-y-2">
          <p className={`text-[11px] ${pedido.estado === 'error' ? 'text-rose-300' : 'text-zinc-400'}`}>
            {ESTADO_LABEL[pedido.estado]}{alta?.estado ? ` · ${alta.estado}` : ''}
          </p>
          {(pedido.error || alta?.error) && <p role="alert" className="text-[11px] text-rose-300">{pedido.error || alta?.error}</p>}
          {pedido.enlaceFormulario && (
            <button type="button" onClick={() => copy(pedido.enlaceFormulario!)} className="w-full inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-zinc-950 px-2.5 py-1.5 text-[11px] font-bold">
              <Copy className="w-3 h-3" /> Copiar enlace del formulario (lo mandás vos)
            </button>
          )}
          {alta?.fechaRespuesta && <p className="text-[11px] text-emerald-300">Respondió el formulario el {alta.fechaRespuesta.slice(0, 10)}</p>}
          <div className="grid gap-1.5">
            {link('Carpeta del estudio', alta?.carpetaCompartida, '(compartida)')}
            {link('Carpeta interna', alta?.carpetaInterna, '(solo vos)')}
            {link('Ficha', alta?.ficha, '(solo vos)')}
          </div>
          {pedido.estado === 'error' && (
            <button type="button" onClick={() => setShowForm(true)} className="text-[11px] font-bold text-amber-300">Corregir y pedir de nuevo</button>
          )}
        </div>
      )}

      {(!pedido || showForm) && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-zinc-400">Registra al estudio en la Sheet y prepara su enlace de Tally. Las carpetas se crean cuando responda.</p>
          <label className="block text-[11px] text-zinc-400">Estudio<input className={input} value={form.estudio} onChange={(e) => setForm({ ...form, estudio: e.target.value })} /></label>
          <label className="block text-[11px] text-zinc-400">Contacto<input className={input} value={form.contacto} placeholder="Nombre y apellido" onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></label>
          <label className="block text-[11px] text-zinc-400">Correo (con el que se comparte la carpeta)<input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="block text-[11px] text-zinc-400">Zona horaria<input className={input} value={form.zonaHoraria} onChange={(e) => setForm({ ...form, zonaHoraria: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-[11px] text-zinc-400"><input type="checkbox" checked={form.prueba} onChange={(e) => setForm({ ...form, prueba: e.target.checked })} /> Es una prueba (usa ID PAF-PRUEBA)</label>
          {errors.length > 0 && <ul role="alert" className="text-[11px] text-rose-300">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-zinc-950 px-3 py-1.5 text-xs font-bold disabled:opacity-60">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Pedir alta
            </button>
            {showForm && <button type="button" onClick={() => setShowForm(false)} className="text-xs text-zinc-400">Cancelar</button>}
          </div>
        </div>
      )}
      {notice && <p role="status" className="text-[11px] text-emerald-300">{notice}</p>}
    </div>
  );
};
