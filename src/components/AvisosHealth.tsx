import React, { useEffect, useState } from 'react';
import { BellOff, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuthHeaders } from '../utils/authAccess';

const OCULTO_KEY = 'cero_avisos_alarma_oculta';
const HORA = 3600000;

/**
 * ALARMA DE AVISOS: si los avisos no te pueden llegar (el reloj no corre o no hay ningún
 * dispositivo ni Telegram), lo dice acá en vez de fallar en silencio. Se puede ocultar por un día.
 */
export const AvisosHealth: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [problemas, setProblemas] = useState<string[]>([]);
  const [oculto, setOculto] = useState(() => { try { return Number(localStorage.getItem(OCULTO_KEY) || 0) > Date.now(); } catch { return false; } });

  useEffect(() => {
    if (oculto) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/automation/status', { headers: await getAuthHeaders() });
        if (!res.ok) return;
        const s = await res.json();
        const salud = (await getDoc(doc(db, 'settings', 'system_health')).catch(() => null))?.data() as { jobs?: Record<string, { lastRunAt?: string }> } | undefined;
        // El reloj corre la tarea de avisos cada 10 minutos: si no corrió en 2 horas, está parado
        const ultima = salud?.jobs?.reminders?.lastRunAt;
        const out: string[] = [];
        if (!s.cronSecret) out.push('Falta la clave del reloj (CRON_SECRET): sin eso no sale ningún aviso.');
        else if (!ultima || Date.now() - Date.parse(ultima) > 2 * HORA) out.push(`El reloj de avisos no está corriendo${ultima ? ` desde el ${new Date(ultima).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}.`);
        if (!s.pushDevices && !s.telegramChat) out.push('No hay dónde mandarte avisos: activalos en esta PC o en tu celular.');
        if (vivo) setProblemas(out);
      } catch { /* sin conexión: no se muestra nada */ }
    })();
    return () => { vivo = false; };
  }, [oculto]);

  if (oculto || !problemas.length) return null;
  const ocultar = () => { setOculto(true); try { localStorage.setItem(OCULTO_KEY, String(Date.now() + 24 * HORA)); } catch { /* sin almacenamiento */ } };
  return (
    <div className="fixed z-[59] left-3 right-3 sm:right-auto sm:w-96 bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-[25rem] rounded-2xl border border-rose-500/40 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur" role="alert">
      <div className="flex items-start gap-3">
        <BellOff className="mt-0.5 w-5 h-5 shrink-0 text-rose-300" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-100">Tus avisos no te están llegando</p>
          <ul className="mt-1 space-y-0.5">{problemas.map((p) => <li key={p} className="text-[11px] text-zinc-300">{p}</li>)}</ul>
          <button type="button" onClick={onOpen} className="mt-2 btn-solid-primary px-3 py-1 text-[11px]">Arreglarlo</button>
        </div>
        <button type="button" aria-label="Ocultar por hoy" onClick={ocultar} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
};
