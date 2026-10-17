// Sanitizar datos para evitar rechazo por campos undefined
// Sanitiza profundamente un objeto o array eliminando cualquier valor undefined
// a cualquier nivel de anidamiento, lo que previene que Firestore rechace escrituras.
export function deepSanitize<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== 'object') return val;
  // Preservar fechas y FieldValues de Firestore (ej. serverTimestamp())
  if (val instanceof Date) return val;
  if (val.constructor && val.constructor.name !== 'Object' && !Array.isArray(val)) {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => deepSanitize(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(val as Record<string, any>)) {
    if (v !== undefined) {
      clean[k] = deepSanitize(v);
    }
  }
  return clean as any;
}
