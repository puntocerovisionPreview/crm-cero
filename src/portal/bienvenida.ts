/**
 * La bienvenida escrita que Juan carga en la ficha y el estudio lee dentro de su portal.
 * Texto libre: cada bloque separado por una línea en blanco es un párrafo, y un bloque de
 * una sola línea corta, sin punto final, se muestra como título ("Cómo trabajamos").
 */
export type BloqueBienvenida = { tipo: 'titulo' | 'parrafo'; texto: string };

export function bloquesBienvenida(texto?: string | null): BloqueBienvenida[] {
  return (texto || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (!b.includes('\n') && b.length <= 60 && !/[.:,;…]$/.test(b) ? { tipo: 'titulo' as const, texto: b } : { tipo: 'parrafo' as const, texto: b }));
}
