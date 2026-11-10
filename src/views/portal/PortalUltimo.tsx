import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, FileText, Megaphone, Package, Pin, Play, Sparkles, X } from 'lucide-react';
import type { PafPortalDoc } from '../../portal/model';
import { ultimoDelPortal, type UltimoItem, type UltimoTipo } from '../../portal/ultimo';
import { haceCuanto } from '../../portal/novedad';

const TIPO: Record<UltimoTipo, { label: string; icon: React.ElementType; abrir: string }> = {
  novedad: { label: 'Novedad', icon: Megaphone, abrir: 'Abrir' },
  mensaje: { label: 'Un mensaje para vos', icon: Play, abrir: 'Ver el video' },
  entrega: { label: 'Te entregamos', icon: Package, abrir: 'Revisar' },
  reunion: { label: 'Reunión', icon: CalendarDays, abrir: 'Abrir' },
  tarea: { label: 'De tu lado', icon: Check, abrir: 'Abrir' },
  reporte: { label: 'Resumen', icon: FileText, abrir: 'Abrir' },
};

const VISIBLES = 4;

/**
 * "Lo último": la historia de lo que fue pasando, de lo más nuevo a lo más viejo.
 * Se arma sola con lo que ya está publicado; un link a un video se ve como un mensaje.
 */
export function LoUltimo({ portal, today, isNew }: { portal: PafPortalDoc; today: string; isNew: (key: string) => boolean }) {
  const items = useMemo(() => ultimoDelPortal(portal), [portal]);
  const [todo, setTodo] = useState(false);
  if (!items.length) return null;
  const lista = todo ? items : items.slice(0, VISIBLES);

  return (
    <section aria-label="Lo último">
      <div className="mb-4">
        <h2 className="text-lg font-normal tracking-tight text-[var(--text-primary)]">Lo último</h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">Lo que fuimos haciendo, de lo más nuevo a lo más viejo.</p>
      </div>
      <ol className="relative">
        <span className="absolute left-[15px] top-4 bottom-4 w-px bg-[var(--border-subtle)]" aria-hidden />
        {lista.map((it, i) => <Item key={it.key} it={it} today={today} nuevo={!!it.nuevoKey && isNew(it.nuevoKey)} primero={i === 0} />)}
      </ol>
      {items.length > VISIBLES && (
        <button type="button" onClick={() => setTodo((v) => !v)} className="mt-1 ml-12 text-xs text-[var(--text-tertiary)] underline underline-offset-4 hover:text-[var(--text-primary)]">
          {todo ? 'Ver menos' : `Ver lo anterior (${items.length - VISIBLES} más)`}
        </button>
      )}
    </section>
  );
}

function Item({ it, today, nuevo, primero }: { it: UltimoItem; today: string; nuevo: boolean; primero: boolean }) {
  const t = TIPO[it.tipo];
  const Icon = it.fijado ? Pin : t.icon;
  const destacado = primero || nuevo || !!it.fijado;
  const esMensaje = it.tipo === 'mensaje';
  return (
    <li className="relative flex gap-4 pb-6 last:pb-2">
      <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${destacado ? 'border-transparent bg-[var(--marca,var(--solid-contrast-bg))] text-[var(--marca-text,var(--solid-contrast-text))]' : 'border-[var(--border-subtle)] bg-white text-[var(--text-tertiary)]'}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-tertiary)]">
          <span>{it.fijado ? 'Para tener a mano' : t.label}</span>
          <span className="font-normal normal-case tracking-normal">{haceCuanto(it.fecha, today)}</span>
          {nuevo && <span className="inline-flex items-center rounded-full bg-[var(--marca,var(--solid-contrast-bg))] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--marca-text,var(--solid-contrast-text))]">Nuevo</span>}
        </p>

        {esMensaje && it.link ? (
          <a href={it.link} target="_blank" rel="noopener noreferrer"
            className="group mt-2 flex items-center gap-4 rounded-2xl bg-[var(--solid-contrast-bg,#111)] px-4 py-4 text-[var(--solid-contrast-text,#fff)] transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 transition group-hover:bg-white/25"><Play className="h-5 w-5 translate-x-[1px] fill-current" /></span>
            <span className="min-w-0 flex-1">
              {it.titulo && <span className="block text-sm font-medium">{it.titulo}</span>}
              {it.texto && <span className="block whitespace-pre-line text-[15px] leading-snug">{it.texto}</span>}
              <span className="mt-1 inline-flex items-center gap-1 text-xs opacity-70">Ver el video <ArrowUpRight className="h-3.5 w-3.5" /></span>
            </span>
          </a>
        ) : (
          <>
            {it.titulo && <p className="mt-1 text-[15px] font-medium text-[var(--text-primary)] break-words">{it.titulo}</p>}
            {it.texto && <p className={`whitespace-pre-line break-words leading-relaxed ${it.titulo ? 'text-sm text-[var(--text-secondary)]' : 'mt-1 text-[15px] text-[var(--text-primary)]'}`}>{it.texto}</p>}
            {it.imagen && (
              <a href={it.imagen} target="_blank" rel="noopener noreferrer" className="mt-2.5 block overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                <img src={it.imagen} alt={it.titulo || 'Imagen de la novedad'} loading="lazy" className="max-h-80 w-full object-cover" />
              </a>
            )}
            {it.link && (
              <a href={it.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]">
                {t.abrir} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Festejo: la primera vez que el cliente entra después de que se cerró un hito, se lo mostramos.
 * Se recuerda en el dispositivo; la primera visita no festeja nada viejo.
 */
export function useFestejo(clienteId: string, etapa: string, hechos: number[], enabled: boolean, siempre = false): [number | null, () => void] {
  const [hito, setHito] = useState<number | null>(null);
  const total = hechos.length;
  const ultimo = total ? Math.max(...hechos) : 0;
  useEffect(() => {
    if (!enabled || !total) return;
    if (siempre) { setHito(ultimo); return; }
    const k = `paf_hitos_${clienteId}_${etapa}`;
    try {
      const antes = localStorage.getItem(k);
      localStorage.setItem(k, String(total));
      if (antes !== null && Number(antes) < total) setHito(ultimo);
    } catch { /* sin almacenamiento: no se festeja */ }
  }, [clienteId, etapa, total, ultimo, enabled, siempre]);
  return [hito, () => setHito(null)];
}

const COLORES = ['var(--marca,#111)', '#f5b301', '#111', '#e85d3a', '#3aa57a'];

export function Festejo({ titulo, total, hechos, onClose }: { titulo: string; total: number; hechos: number; onClose: () => void }) {
  const [papeles, setPapeles] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPapeles(false), 3200); return () => clearTimeout(t); }, []);
  const piezas = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: (i * 37 + 11) % 100, delay: ((i * 53) % 90) / 100, dur: 1.9 + ((i * 29) % 100) / 80, color: COLORES[i % COLORES.length], ancho: 6 + (i % 3) * 2, giro: (i % 2 ? 1 : -1) * (240 + (i * 41) % 360),
  })), []);
  return (
    <>
      {papeles && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
          {piezas.map((c, i) => (
            <span key={i} className="portal-confeti" style={{ left: `${c.left}%`, width: c.ancho, height: c.ancho * 1.6, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, ['--giro' as string]: `${c.giro}deg` }} />
          ))}
        </div>
      )}
      <div role="status" className="mb-8 flex items-start gap-4 rounded-2xl bg-[var(--marca,var(--solid-contrast-bg))] px-5 py-4 text-[var(--marca-text,var(--solid-contrast-text))] t-success-pop">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] opacity-80">Hito cerrado · {hechos} de {total}</p>
          <p className="mt-0.5 text-lg font-light leading-snug sm:text-xl">Cerramos <span className="font-medium">{titulo}</span>. Un paso más de tu recorrido.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-full p-1 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
      </div>
    </>
  );
}

/** "Buen día" / "Buenas tardes" / "Buenas noches", según la hora de quien entra */
export const saludoDelMomento = (h = new Date().getHours()) => (h >= 6 && h < 13 ? 'Buen día' : h >= 13 && h < 20 ? 'Buenas tardes' : 'Buenas noches');
