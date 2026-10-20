import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { sortByFileName } from '../content/model';

/**
 * Elegir imágenes: arrastrarlas o tocar para buscarlas. Quedan en el orden del nombre
 * (01, 02, 03…) y se pueden mover o quitar antes de subir.
 */
export const ImageDrop: React.FC<{
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}> = ({ files, onChange, label = 'Arrastrá las imágenes acá o tocá para elegirlas', hint = 'Quedan en el orden del nombre del archivo (01, 02, 03…). Después podés moverlas.', disabled }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (list: FileList | null) => {
    const imgs = Array.from(list || []).filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name));
    if (imgs.length) onChange([...files, ...sortByFileName(imgs)]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
          over ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/60'
        } disabled:opacity-50`}
      >
        <ImagePlus className="w-6 h-6 mx-auto text-[var(--accent)]" aria-hidden />
        <span className="block mt-1.5 text-[14px] font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="block text-[12px] text-[var(--text-tertiary)]">{hint}</span>
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative shrink-0 w-20">
              <div className="aspect-[4/5] rounded-md overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                <img src={urls[i]} alt={f.name} className="w-full h-full object-cover" />
              </div>
              <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 rounded bg-black/70 text-white">{i + 1}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, k) => k !== i))}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white"
                aria-label={`Quitar ${f.name}`}
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex justify-between mt-1">
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="p-0.5 text-[var(--text-secondary)] disabled:opacity-30" aria-label="Mover antes">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" disabled={disabled || i === files.length - 1} onClick={() => move(i, 1)} className="p-0.5 text-[var(--text-secondary)] disabled:opacity-30" aria-label="Mover después">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
