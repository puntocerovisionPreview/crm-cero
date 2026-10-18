import React, { useEffect, useId, useRef, useState } from 'react';

export interface LinePoint {
  label: string;
  value: number;
}

interface Props {
  points: LinePoint[];
  /** Cómo se escribe un valor (tooltip, etiqueta del último punto y tabla accesible) */
  format: (n: number) => string;
  /** Nombre de la serie para lectores de pantalla */
  title: string;
  height?: number;
  className?: string;
}

const PAD = { top: 22, right: 10, bottom: 6, left: 6 };

// Gráfico de línea fina estilo rimu: trazo de 1.5px en tinta, puntos chicos,
// un velo que se desvanece hacia abajo y el último valor rotulado.
// Al pasar el mouse (o tocar) aparece una guía vertical con el valor del punto.
export const ThinLineChart: React.FC<Props> = ({ points, format, title, height = 96, className = '' }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, '');

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const max = Math.max(...points.map(p => p.value), 0);
  const min = Math.min(...points.map(p => p.value), 0);
  const span = max - min || 1;
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = n > 1 ? `${line} L${x(n - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z` : '';

  const pick = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rel = clientX - el.getBoundingClientRect().left - PAD.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round((rel / innerW) * (n - 1)))));
  };

  const last = n - 1;
  const active = hover ?? last;
  const tipLeft = n ? Math.min(Math.max(x(active), 40), Math.max(width - 40, 40)) : 0;

  return (
    <div
      ref={wrapRef}
      className={`relative select-none text-[var(--text-primary)] ${className}`}
      style={{ height }}
      onPointerMove={e => pick(e.clientX)}
      onPointerDown={e => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${title}: último valor ${format(points[last].value)}`} className="block overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Guía punteada en el máximo: la única línea de referencia */}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(max)} y2={y(max)} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="2 4" />

          {area && <path d={area} fill={`url(#${gradId})`} />}
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) => (
            <circle key={p.label} cx={x(i)} cy={y(p.value)} r={i === last ? 3.5 : 2} fill={i === last ? 'var(--bg-surface)' : 'currentColor'} stroke="currentColor" strokeWidth={i === last ? 1.5 : 0} />
          ))}

          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top - 6} y2={PAD.top + innerH} stroke="var(--border-strong)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={4} fill="var(--bg-surface)" stroke="currentColor" strokeWidth={1.5} />
            </>
          )}
        </svg>
      )}

      {/* Rótulo: el último valor, o el del punto bajo el cursor */}
      {width > 0 && n > 0 && (
        <div
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none tabular-nums pointer-events-none"
          style={{ left: tipLeft }}
          aria-hidden
        >
          <span className="text-[var(--text-primary)]">{format(points[active].value)}</span>
          {hover !== null && <span className="ml-1 text-[var(--text-tertiary)]">{points[active].label}</span>}
        </div>
      )}

      {/* Tabla para lectores de pantalla */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map(p => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
