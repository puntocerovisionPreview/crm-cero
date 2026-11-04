import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { markAvisosLeidos, subscribeAvisosLeidos } from '../portal/store';
import { playTaskDone } from '../utils/sound';

/** Un aviso del portal: el cliente tocó "Terminé" en una tarea */
export interface ClientAlert {
  key: string; // clienteId/avisoId
  projectId: string;
  estudio: string;
  tarea: string;
  creadoEn: string; // ISO
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};

/**
 * AVISOS DE CLIENTES, en cualquier pantalla del CRM: cuando un cliente termina una tarea
 * aparece una tarjeta abajo a la derecha (con sonido si llega con la app abierta). Lo que pasó
 * con la app cerrada aparece al abrirla. Se va al tocar "Revisar" o la X, o cuando la aprobás.
 * Lo leído se guarda en la base: no vuelve a aparecer en otro dispositivo.
 */
export const ClientAlerts: React.FC<{ alerts: ClientAlert[]; onOpen: (projectId: string) => void }> = ({ alerts, onOpen }) => {
  const [leidos, setLeidos] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => subscribeAvisosLeidos(setLeidos), []);

  const unread = useMemo(
    () => (leidos ? alerts.filter((a) => !leidos.has(a.key)).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)) : []),
    [alerts, leidos]
  );

  // Sonido solo para lo que llega con la app abierta (no para lo pendiente al abrir)
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!leidos) return;
    if (known.current) {
      const nuevos = unread.filter((a) => !known.current!.has(a.key));
      if (nuevos.length) {
        playTaskDone();
        // Con la pestaña en segundo plano en la PC: aviso del sistema (si diste permiso)
        try {
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            nuevos.forEach((a) => new Notification(`${a.estudio} terminó una tarea`, { body: a.tarea, tag: a.key }));
          }
        } catch { /* el navegador no deja: queda la tarjeta en la app */ }
      }
    }
    known.current = new Set(unread.map((a) => a.key));
  }, [unread, leidos]);

  // Contador en la pestaña del navegador, para verlo aunque estés en otra
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = unread.length ? `(${unread.length}) ${base}` : base;
  }, [unread.length]);

  if (!unread.length) return null;
  const read = (keys: string[]) => {
    setLeidos((s) => new Set([...(s || []), ...keys]));
    markAvisosLeidos(keys).catch(() => undefined);
  };
  const visible = expanded ? unread : unread.slice(0, 3);

  return (
    <div className="fixed z-[60] right-3 left-3 sm:left-auto sm:w-96 bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-6 space-y-2 pointer-events-none" role="region" aria-label="Avisos de clientes" aria-live="polite">
      {visible.map((a) => (
        <div key={a.key} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-zinc-900/95 p-3 shadow-2xl shadow-black/50 backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 className="mt-0.5 w-5 h-5 shrink-0 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-100">{a.estudio} terminó una tarea</p>
            <p className="mt-0.5 text-xs text-zinc-300 break-words">«{a.tarea}»</p>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={() => { read([a.key]); onOpen(a.projectId); }} className="btn-solid-primary px-3 py-1 text-[11px]">Revisar</button>
              <span className="text-[10px] text-zinc-500">{ago(a.creadoEn)}</span>
            </div>
          </div>
          <button type="button" aria-label="Marcar como visto" onClick={() => read([a.key])} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
        </div>
      ))}
      {unread.length > 3 && (
        <div className="pointer-events-auto flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-[11px] text-zinc-300 backdrop-blur">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="font-bold hover:text-zinc-100">{expanded ? 'Ver menos' : `Ver los ${unread.length} avisos`}</button>
          <button type="button" onClick={() => read(unread.map((a) => a.key))} className="text-zinc-500 hover:text-zinc-200">Marcar todos como vistos</button>
        </div>
      )}
    </div>
  );
};
