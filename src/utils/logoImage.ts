/**
 * Logo del cliente: se achica en el navegador (máx. 256 px) y queda como data URL chica,
 * así se guarda junto al portal sin usar Storage. También saca el color principal.
 */
export async function shrinkLogo(file: File, max = 256): Promise<{ dataUrl: string; color: string | null }> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Subí una imagen PNG, JPG, WebP o SVG.');
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      el.src = src;
    });
    const w0 = img.naturalWidth || max, h0 = img.naturalHeight || max;
    const scale = Math.min(1, max / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // WebP si el navegador lo soporta (más liviano); si no, PNG. Ambos conservan la transparencia
    let dataUrl = canvas.toDataURL('image/webp', 0.9);
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > 200_000) throw new Error('El logo quedó muy pesado. Probá con uno más simple.');
    return { dataUrl, color: mainColor(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** El color con más presencia que no sea blanco, negro ni gris (null si el logo es monocromo) */
function mainColor(px: Uint8ClampedArray): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 16) {
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (a < 200) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 40 || mn > 225 || mx - mn < 40) continue; // negro, blanco o gris
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const c = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += r; c.g += g; c.b += b;
    buckets.set(key, c);
  }
  const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  if (!best || best.n < 6) return null;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
