/** Doble transaccional: ejecuta transacciones en serie, soporta queries y dot updates. */
export function memoryFirestore(seed: Record<string, any> = {}) {
  const records = new Map<string, any>(Object.entries(structuredClone(seed)));
  const copy = (x: any) => x === undefined ? undefined : structuredClone(x);
  const merge = (a: any, b: any): any => {
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) result[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : copy(v);
    return result;
  };
  const snapshot = (path: string): any => ({ id: path.split('/').at(-1), ref: doc(path), exists: records.has(path), data: () => copy(records.get(path)) });
  const doc = (path: string): any => ({
    id: path.split('/').at(-1), path, get: async () => snapshot(path),
    set: async (data: any, opts?: any) => { records.set(path, opts?.merge ? merge(records.get(path), data) : copy(data)); },
    update: async (data: any) => {
      if (!records.has(path)) throw new Error('not found');
      const value = copy(records.get(path));
      for (const [key, v] of Object.entries(data)) {
        const parts = key.split('.'); let target = value;
        for (const p of parts.slice(0, -1)) target = target[p] ||= {};
        target[parts.at(-1)!] = copy(v);
      }
      records.set(path, value);
    },
    delete: async () => { records.delete(path); },
  });
  const collection = (name: string, filters: [string, any][] = [], max = Infinity): any => ({
    id: name, doc: (id: string) => doc(`${name}/${id}`),
    where: (key: string, op: string, value: any) => { if (op !== '==') throw new Error('Unsupported query'); return collection(name, [...filters, [key, value]], max); },
    limit: (n: number) => collection(name, filters, n),
    get: async () => {
      const docs = [...records.keys()].filter(k => k.startsWith(`${name}/`) && filters.every(([f,v]) => records.get(k)[f] === v)).slice(0,max).map(snapshot);
      return { docs, empty: !docs.length, forEach: (fn: any) => docs.forEach(fn) };
    },
  });
  let queue = Promise.resolve();
  const db: any = { collection, runTransaction: (fn: any) => {
    const result = queue.then(async () => {
      const before = new Map([...records].map(([k,v]) => [k,copy(v)]));
      const writes: (() => Promise<void>)[] = [];
      const tx = {
        get: (ref: any) => ref.get(), set: (ref: any, data: any, opts?: any) => writes.push(() => ref.set(data, opts)),
        update: (ref: any, data: any) => writes.push(() => ref.update(data)), delete: (ref: any) => writes.push(() => ref.delete()),
        create: (ref: any, data: any) => writes.push(async () => { if (records.has(ref.path)) throw new Error('exists'); await ref.set(data); }),
      };
      try { const result = await fn(tx); for (const write of writes) await write(); return result; }
      catch (e) { records.clear(); before.forEach((v,k) => records.set(k,v)); throw e; }
    });
    queue = result.catch(() => {}); return result;
  } };
  return { db, records };
}
