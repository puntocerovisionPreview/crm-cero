import { useEffect, useState } from 'react';
import { subscribeVisitas } from './store';
import type { PortalVisita } from './salud';

// Una sola suscripción para toda la app (lista, tablero, ficha e Inicio la comparten)
let actual = new Map<string, PortalVisita>();
const oyentes = new Set<(v: Map<string, PortalVisita>) => void>();
let cortar: (() => void) | null = null;

/** Cuándo entró cada estudio a su portal, por clienteId (solo para el CRM) */
export function useVisitas(): Map<string, PortalVisita> {
  const [visitas, setVisitas] = useState(actual);
  useEffect(() => {
    oyentes.add(setVisitas);
    if (!cortar) cortar = subscribeVisitas((v) => { actual = v; oyentes.forEach((f) => f(v)); });
    else setVisitas(actual);
    return () => {
      oyentes.delete(setVisitas);
      if (!oyentes.size && cortar) { cortar(); cortar = null; }
    };
  }, []);
  return visitas;
}
