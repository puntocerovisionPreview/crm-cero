/** Historial privado del cliente: qué se aprobó, confirmó o pidió, y cuándo */
export function conHistorial<T extends { pafHistorial?: { fecha: string; texto: string }[] }>(project: T, ...textos: string[]): { pafHistorial: { fecha: string; texto: string }[] } {
  const fecha = new Date().toISOString();
  return { pafHistorial: [...textos.map((texto) => ({ fecha, texto })), ...(project.pafHistorial || [])].slice(0, 200) };
}
