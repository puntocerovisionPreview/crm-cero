// UI Preferences management using ui_* keys in localStorage

export interface UiPreferences {
  hideCerebro: boolean;
  hideGrafo: boolean;
  hideDineroPersonal: boolean;
  hideCalendarioMes: boolean;
  hideHoyObjetivos: boolean;
  hideHoyTiempo: boolean;
  hideHoyAtrasadas: boolean;
  hideHoyInbox: boolean;
  hideHoyFocoBanner: boolean;
  hideVistasEisenhowerKanban: boolean;
  hoyBlocksOrder: string[];
}

export const DEFAULT_HOY_BLOCKS_ORDER = [
  'cobros',
  'foco',
  'actividades',
  'atrasadas',
  'inbox',
  'objetivos',
  'tiempo'
];

export const HOY_BLOCK_LABELS: Record<string, string> = {
  cobros: 'Franja de cobros del día y vencidos',
  foco: 'Lo más importante hoy (Foco matutino)',
  actividades: 'Tareas y reuniones del día por horario',
  atrasadas: 'Tareas y reuniones atrasadas',
  inbox: 'Inbox sin fecha programada',
  objetivos: 'Objetivos de la semana',
  tiempo: 'Presupuesto y balance de tiempo'
};

const UI_KEYS = {
  hideCerebro: 'ui_hide_cerebro',
  hideGrafo: 'ui_hide_grafo',
  hideDineroPersonal: 'ui_hide_dinero_personal',
  hideCalendarioMes: 'ui_hide_calendario_mes',
  hideHoyObjetivos: 'ui_hide_hoy_objetivos',
  hideHoyTiempo: 'ui_hide_hoy_tiempo',
  hideHoyAtrasadas: 'ui_hide_hoy_atrasadas',
  hideHoyInbox: 'ui_hide_hoy_inbox',
  hideHoyFocoBanner: 'ui_hide_hoy_foco_banner',
  hideVistasEisenhowerKanban: 'ui_hide_vistas_eisenhower_kanban',
  hoyBlocksOrder: 'ui_hoy_blocks_order',
};

export function getUiPreferences(): UiPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      hideCerebro: false,
      hideGrafo: false,
      hideDineroPersonal: false,
      hideCalendarioMes: false,
      hideHoyObjetivos: false,
      hideHoyTiempo: false,
      hideHoyAtrasadas: false,
      hideHoyInbox: false,
      hideHoyFocoBanner: false,
      hideVistasEisenhowerKanban: false,
      hoyBlocksOrder: DEFAULT_HOY_BLOCKS_ORDER,
    };
  }

  let order = DEFAULT_HOY_BLOCKS_ORDER;
  try {
    const rawOrder = localStorage.getItem(UI_KEYS.hoyBlocksOrder);
    if (rawOrder) {
      const parsed = JSON.parse(rawOrder);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all valid blocks are present
        const valid = parsed.filter(b => DEFAULT_HOY_BLOCKS_ORDER.includes(b));
        DEFAULT_HOY_BLOCKS_ORDER.forEach(b => {
          if (!valid.includes(b)) valid.push(b);
        });
        order = valid;
      }
    }
  } catch {
    order = DEFAULT_HOY_BLOCKS_ORDER;
  }

  return {
    hideCerebro: localStorage.getItem(UI_KEYS.hideCerebro) === 'true',
    hideGrafo: localStorage.getItem(UI_KEYS.hideGrafo) === 'true',
    hideDineroPersonal: localStorage.getItem(UI_KEYS.hideDineroPersonal) === 'true',
    hideCalendarioMes: localStorage.getItem(UI_KEYS.hideCalendarioMes) === 'true',
    hideHoyObjetivos: localStorage.getItem(UI_KEYS.hideHoyObjetivos) === 'true',
    hideHoyTiempo: localStorage.getItem(UI_KEYS.hideHoyTiempo) === 'true',
    hideHoyAtrasadas: localStorage.getItem(UI_KEYS.hideHoyAtrasadas) === 'true',
    hideHoyInbox: localStorage.getItem(UI_KEYS.hideHoyInbox) === 'true',
    hideHoyFocoBanner: localStorage.getItem(UI_KEYS.hideHoyFocoBanner) === 'true',
    hideVistasEisenhowerKanban: localStorage.getItem(UI_KEYS.hideVistasEisenhowerKanban) === 'true',
    hoyBlocksOrder: order,
  };
}

export function setUiPreference<K extends keyof UiPreferences>(key: K, value: UiPreferences[K]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const storageKey = UI_KEYS[key as keyof typeof UI_KEYS];
  if (!storageKey) return;

  if (typeof value === 'boolean') {
    localStorage.setItem(storageKey, String(value));
  } else {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }
}
