/**
 * RESERVA DE CONTACTOS (base de prospección)
 *
 * Toma el CSV del scraper de Google Maps (Apify o Selenium), lo limpia, descarta lo que no
 * sirve y le pone un puntaje a cada contacto según qué tan buen candidato es para .Cero.
 * Lógica pura: la usan la app (al subir el CSV) y las pruebas.
 */

export type PoolSegment = 'arquitectura' | 'paisajismo' | 'interiorismo' | 'construccion';
export type PhoneKind = 'celular' | 'posible' | 'fijo';

export interface PoolLead {
  id: string; // estable: place_id o teléfono
  name: string;
  category: string;
  segment: PoolSegment;
  city: string;
  country: string; // código ISO (AR, MX...)
  countryName: string;
  phoneDisplay: string;
  whatsapp: string; // dígitos listos para wa.me (con código de país)
  phoneKind: PhoneKind;
  website?: string;
  instagram?: string;
  rating?: number;
  reviews?: number;
  mapsUrl?: string;
  score: number; // 0-100
  tier: 'A' | 'B' | 'C';
  reasons: string[]; // por qué tiene ese puntaje
}

export interface PoolReport {
  total: number;
  accepted: PoolLead[];
  rejected: Record<string, number>; // motivo -> cantidad
}

// ---------------- CSV ----------------

/** Parser CSV que respeta comillas y saltos de línea dentro de los campos. */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.indexOf('\n') === -1 ? undefined : src.indexOf('\n'));
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = r[i] ?? ''));
    return o;
  });
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------- LIMPIEZA ----------------

// El scraper con Selenium deja íconos (caracteres de uso privado) y "Enviar al teléfono"
export function cleanText(v?: string): string {
  return (v || '').replace(/[-]/g, '').replace(/\s+/g, ' ').trim();
}

const COUNTRIES: Record<string, { code: string; dial: string }> = {
  argentina: { code: 'AR', dial: '54' },
  'méxico': { code: 'MX', dial: '52' },
  mexico: { code: 'MX', dial: '52' },
  colombia: { code: 'CO', dial: '57' },
  chile: { code: 'CL', dial: '56' },
  'perú': { code: 'PE', dial: '51' },
  peru: { code: 'PE', dial: '51' },
  ecuador: { code: 'EC', dial: '593' },
  uruguay: { code: 'UY', dial: '598' },
  venezuela: { code: 'VE', dial: '58' },
  paraguay: { code: 'PY', dial: '595' },
  bolivia: { code: 'BO', dial: '591' },
  'costa rica': { code: 'CR', dial: '506' },
  brasil: { code: 'BR', dial: '55' },
  'españa': { code: 'ES', dial: '34' },
};

export const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina', MX: 'México', CO: 'Colombia', CL: 'Chile', PE: 'Perú', EC: 'Ecuador', UY: 'Uruguay',
  VE: 'Venezuela', PY: 'Paraguay', BO: 'Bolivia', CR: 'Costa Rica', BR: 'Brasil', ES: 'España',
};

function countryFrom(row: Record<string, string>): { code: string; dial: string; name: string } | null {
  const search = cleanText(row['ciudad_busqueda'] || row['pais'] || '').toLowerCase();
  const key = Object.keys(COUNTRIES).find((k) => search.endsWith(k) || search.includes(`, ${k}`));
  if (key) return { ...COUNTRIES[key], name: COUNTRY_NAMES[COUNTRIES[key].code] };
  const iso = cleanText(row['pais']).toUpperCase();
  const byIso = Object.values(COUNTRIES).find((c) => c.code === iso);
  return byIso ? { ...byIso, name: COUNTRY_NAMES[byIso.code] } : null;
}

/**
 * Teléfono → número para WhatsApp (con código de país) y si es celular.
 * Celular = casi seguro tiene WhatsApp y suele ser del dueño.
 */
export function analyzePhone(raw: string, country: { code: string; dial: string }): { whatsapp: string; kind: PhoneKind; display: string } | null {
  const display = cleanText(raw);
  if (!display || /enviar/i.test(display)) return null;
  let d = display.replace(/\D/g, '');
  if (d.length < 7) return null;

  if (country.code === 'AR') {
    // Formatos: "+54 9 11 ...", "+54 11 ...", "011 15-1234-5678", "0351 15-591-3610", "0351 753-2543"
    if (d.startsWith('54')) {
      d = d.slice(2);
      const mobile = d.startsWith('9');
      if (mobile) d = d.slice(1);
      return { whatsapp: `549${d}`, kind: mobile ? 'celular' : 'fijo', display };
    }
    if (d.startsWith('0')) d = d.slice(1);
    const m = display.match(/^\s*0?(\d{2,4})\s*15[\s-]/); // característica + 15
    if (m) {
      const area = m[1];
      const rest = d.slice(area.length + 2);
      return { whatsapp: `549${area}${rest}`, kind: 'celular', display };
    }
    return { whatsapp: `549${d}`, kind: 'fijo', display };
  }

  if (d.startsWith(country.dial)) d = d.slice(country.dial.length);
  else if (d.startsWith('0')) d = d.replace(/^0+/, '');
  const full = `${country.dial}${d}`;
  const starts = (re: RegExp) => re.test(d);
  let kind: PhoneKind = 'fijo';
  switch (country.code) {
    case 'MX': kind = 'posible'; break; // en México no se distingue por el número
    case 'CO': kind = starts(/^3\d{9}$/) ? 'celular' : 'fijo'; break;
    case 'CL': kind = starts(/^9\d{8}$/) ? 'celular' : 'fijo'; break;
    case 'PE': kind = starts(/^9\d{8}$/) ? 'celular' : 'fijo'; break;
    case 'EC': kind = starts(/^9\d{8}$/) ? 'celular' : 'fijo'; break;
    case 'UY': kind = starts(/^9\d{7}$/) ? 'celular' : 'fijo'; break;
    case 'VE': kind = starts(/^4(12|14|16|24|26)\d{7}$/) ? 'celular' : 'fijo'; break;
    case 'PY': kind = starts(/^9\d{8}$/) ? 'celular' : 'fijo'; break;
    case 'BO': kind = starts(/^[67]\d{7}$/) ? 'celular' : 'fijo'; break;
    case 'CR': kind = starts(/^[5-8]\d{7}$/) ? 'celular' : 'fijo'; break;
    case 'BR': kind = starts(/^\d{2}9\d{8}$/) ? 'celular' : 'fijo'; break;
    default: kind = 'posible';
  }
  return { whatsapp: full, kind, display };
}

// ---------------- RUBRO ----------------

function segmentFor(category: string, search: string): PoolSegment | null {
  const c = category.toLowerCase();
  const s = search.toLowerCase();
  if (/jardiner|vivero|centro de jardin|floris|fumigad|piscina|limpieza/.test(c)) return null; // no son estudios
  if (/interior/.test(c)) return 'interiorismo';
  if (/paisaj/.test(c)) return 'paisajismo';
  if (/arquitect|diseñ/.test(c)) return 'arquitectura';
  if (/constru|contratista|obra|edific|reforma|remodel/.test(c)) return 'construccion';
  // categoría vacía o genérica ("Oficinas de empresa"): se usa lo que se buscó, con menos confianza
  if (/arquitect|diseño arquitect/.test(s)) return 'arquitectura';
  if (/paisaj/.test(s)) return 'paisajismo';
  if (/constru/.test(s)) return 'construccion';
  return null;
}

const SEGMENT_POINTS: Record<PoolSegment, number> = { arquitectura: 40, interiorismo: 36, paisajismo: 34, construccion: 22 };

function webKind(url: string): 'ninguna' | 'redes' | 'propia' {
  if (!url) return 'ninguna';
  if (/instagram\.com|facebook\.com|linktr\.ee|wa\.me|whatsapp|sites\.google|business\.site|wixsite|blogspot|tiktok\.com/i.test(url)) return 'redes';
  return 'propia';
}

function toNum(v?: string): number | undefined {
  const n = parseFloat(cleanText(v).replace(',', '.'));
  return isNaN(n) ? undefined : n;
}

function stableId(row: Record<string, string>, whatsapp: string): string {
  const place = cleanText(row['place_id']) || (row['google_maps_url'] || '').match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1] || '';
  return `pool_${(place || whatsapp).replace(/[^A-Za-z0-9]/g, '').slice(-40)}`;
}

/**
 * Puntaje (0-100) de qué tan buen candidato es:
 * - Rubro: estudios de arquitectura primero; interiorismo y paisajismo; constructoras después.
 * - Contacto: celular (WhatsApp casi seguro, suele ser del dueño) > posible > fijo.
 * - Presencia débil: sin web o solo redes = más necesita lo que vendés.
 * - Tamaño: pocas reseñas = estudio chico, lo atiende el dueño.
 */
export function scoreLead(segment: PoolSegment, phoneKind: PhoneKind, website: string, rating?: number, reviews?: number) {
  const reasons: string[] = [];
  let score = SEGMENT_POINTS[segment];
  reasons.push(segment === 'construccion' ? 'Constructora' : `Rubro: ${segment}`);

  if (phoneKind === 'celular') {
    score += 30;
    reasons.push('Celular (WhatsApp)');
  } else if (phoneKind === 'posible') {
    score += 20;
    reasons.push('Teléfono probablemente con WhatsApp');
  } else {
    score += 5;
    reasons.push('Teléfono fijo');
  }

  const web = webKind(website);
  if (web === 'ninguna') {
    score += 15;
    reasons.push('Sin sitio web');
  } else if (web === 'redes') {
    score += 12;
    reasons.push('Solo redes o web gratuita');
  } else {
    score += 3;
    reasons.push('Tiene sitio web');
  }

  if (reviews === undefined) score += 6;
  else if (reviews <= 80) {
    score += 10;
    reasons.push('Estudio chico');
  } else if (reviews <= 300) score += 5;
  else reasons.push('Empresa grande');

  if (rating !== undefined && rating < 3.5) {
    score -= 10;
    reasons.push('Calificación baja');
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function tierFor(score: number): 'A' | 'B' | 'C' {
  return score >= 75 ? 'A' : score >= 60 ? 'B' : 'C';
}

const EXCLUDED_COUNTRIES = ['BR']; // el guion está en español

/** Procesa el CSV del scraper: limpia, descarta, quita duplicados y ordena por puntaje. */
export function buildPool(rows: Record<string, string>[], options: { excludeIds?: Set<string>; excludePhones?: Set<string> } = {}): PoolReport {
  const rejected: Record<string, number> = {};
  const reject = (why: string) => (rejected[why] = (rejected[why] || 0) + 1);
  const byPhone = new Map<string, PoolLead>();
  const seenIds = new Set<string>();

  rows.forEach((row) => {
    const name = cleanText(row['nombre']);
    if (!name) return reject('Sin nombre');
    if (/^true$/i.test(cleanText(row['permanentemente_cerrado']))) return reject('Cerrado');
    const country = countryFrom(row);
    if (!country) return reject('País desconocido');
    if (EXCLUDED_COUNTRIES.includes(country.code)) return reject('Brasil (portugués)');
    const category = cleanText(row['categoria']);
    const segment = segmentFor(category, cleanText(row['busqueda']));
    if (!segment) return reject('Rubro fuera del nicho');
    const phone = analyzePhone(row['telefono'] || '', country);
    if (!phone) return reject('Sin teléfono');
    const phoneKey = phone.whatsapp.slice(-7);
    if (options.excludePhones?.has(phoneKey)) return reject('Ya en prospección o cliente');
    const website = cleanText(row['sitio_web']);
    const rating = toNum(row['rating']);
    const reviews = toNum(row['num_reviews']);
    const { score, reasons } = scoreLead(segment, phone.kind, website, rating, reviews);
    const id = stableId(row, phone.whatsapp);
    if (options.excludeIds?.has(id) || seenIds.has(id)) return reject('Repetido');
    const ig = website.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
    const lead: PoolLead = {
      id,
      name,
      category: category || cleanText(row['busqueda']),
      segment,
      city: cleanText(row['ciudad']) || cleanText(row['ciudad_busqueda']).split(',')[0],
      country: country.code,
      countryName: country.name,
      phoneDisplay: phone.display,
      whatsapp: phone.whatsapp,
      phoneKind: phone.kind,
      website: website || undefined,
      instagram: ig ? `@${ig}` : undefined,
      rating,
      reviews,
      mapsUrl: cleanText(row['google_maps_url']) || undefined,
      score,
      tier: tierFor(score),
      reasons,
    };
    const prev = byPhone.get(phoneKey);
    if (prev) {
      reject('Repetido');
      if (lead.score > prev.score) byPhone.set(phoneKey, lead);
      return;
    }
    seenIds.add(id);
    byPhone.set(phoneKey, lead);
  });

  // Empates: orden variado pero fijo (no alfabético, para no tener siempre los "A..." primero)
  const accepted = [...byPhone.values()].sort((a, b) => b.score - a.score || hash(a.id) - hash(b.id));
  return { total: rows.length, accepted, rejected };
}

/** Reparto variado: no 10 del mismo país o rubro seguidos. Toma los mejores alternando. */
export function pickBatch(available: PoolLead[], count: number, filters: { countries?: string[]; segments?: PoolSegment[] } = {}): PoolLead[] {
  const pool = available
    .filter((l) => !filters.countries?.length || filters.countries.includes(l.country))
    .filter((l) => !filters.segments?.length || filters.segments.includes(l.segment))
    .sort((a, b) => b.score - a.score || hash(a.id) - hash(b.id));
  const picked: PoolLead[] = [];
  const perCountry = new Map<string, number>();
  const maxPerCountry = Math.max(2, Math.ceil(count / 3));
  for (const l of pool) {
    if (picked.length >= count) break;
    if ((perCountry.get(l.country) || 0) >= maxPerCountry) continue;
    picked.push(l);
    perCountry.set(l.country, (perCountry.get(l.country) || 0) + 1);
  }
  // si los filtros dejan pocos países, completar sin el tope
  for (const l of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(l)) picked.push(l);
  }
  return picked;
}

/** CSV para Excel (separado por ;) con la base filtrada. */
export function poolToCsv(leads: PoolLead[]): string {
  const head = ['prioridad', 'puntaje', 'nombre', 'rubro', 'categoria', 'ciudad', 'pais', 'telefono', 'whatsapp', 'tipo_telefono', 'instagram', 'sitio_web', 'rating', 'reseñas', 'motivos', 'google_maps'];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = leads.map((l) =>
    [l.tier, l.score, l.name, l.segment, l.category, l.city, l.countryName, l.phoneDisplay, `https://wa.me/${l.whatsapp}`, l.phoneKind, l.instagram, l.website, l.rating, l.reviews, l.reasons.join(' · '), l.mapsUrl]
      .map(esc)
      .join(';')
  );
  return '﻿' + [head.map(esc).join(';'), ...lines].join('\n');
}
