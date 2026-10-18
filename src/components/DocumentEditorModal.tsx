import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Project, StudioPaymentSettings } from '../types';
import { DocItem, DocumentKind, STUDIO_NAME, StudioDocument, docTotal, newToken, nextNumber, paymentInfoFrom, saveDocument } from '../utils/documents';
import { addDays } from '../utils/dates';
import { hapticFeedback } from '../utils/haptics';

export type DocumentPrefill = Partial<Pick<StudioDocument, 'kind' | 'projectId' | 'prospectId' | 'clientName' | 'contactName' | 'phone' | 'email' | 'items' | 'currency' | 'paymentDate' | 'paymentMethod' | 'paymentId' | 'notes'>>;

interface Props {
  isOpen: boolean;
  prefill?: DocumentPrefill;
  projects: Project[];
  documents: StudioDocument[];
  settings?: StudioPaymentSettings;
  today: string;
  onClose: () => void;
  onSaved: (doc: StudioDocument) => void;
}

const DEFAULT_NOTES = 'Seña del 50% para comenzar y 50% contra entrega.\nIncluye una ronda de ajustes.';
const field =
  'w-full h-10 rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40';

// Crear un presupuesto o un recibo con link para el cliente
export const DocumentEditorModal: React.FC<Props> = ({ isOpen, prefill, projects, documents, settings, today, onClose, onSaved }) => {
  const [kind, setKind] = useState<DocumentKind>('presupuesto');
  const [projectId, setProjectId] = useState('');
  const [clientName, setClientName] = useState('');
  const [contactName, setContactName] = useState('');
  const [items, setItems] = useState<DocItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('USD');
  const [validDays, setValidDays] = useState(15);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const k = prefill?.kind || 'presupuesto';
    setKind(k);
    setProjectId(prefill?.projectId || '');
    setClientName(prefill?.clientName || '');
    setContactName(prefill?.contactName || '');
    setItems(prefill?.items?.length ? prefill.items : [{ description: '', quantity: 1, unitPrice: 0 }]);
    setCurrency(prefill?.currency || 'USD');
    setNotes(prefill?.notes ?? (k === 'presupuesto' ? DEFAULT_NOTES : ''));
    setPaymentDate(prefill?.paymentDate || today);
    setPaymentMethod(prefill?.paymentMethod || 'transferencia');
    setValidDays(15);
    setError(null);
  }, [isOpen, prefill, today]);

  const total = useMemo(() => docTotal(items), [items]);
  const clientOptions = useMemo(() => projects.filter(p => !p.archived).sort((a, b) => a.clientName.localeCompare(b.clientName)), [projects]);

  if (!isOpen) return null;

  const pickProject = (id: string) => {
    setProjectId(id);
    const p = projects.find(x => x.id === id);
    if (p) {
      setClientName(p.clientName);
      setContactName(p.ownerName || '');
      if (p.estimatedCurrency) setCurrency(p.estimatedCurrency);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = items.filter(i => i.description.trim() && i.unitPrice > 0);
    if (!clientName.trim()) return setError('Falta el nombre del cliente.');
    if (!clean.length) return setError('Agregá al menos un ítem con importe.');
    setSaving(true);
    setError(null);
    const project = projects.find(p => p.id === projectId);
    const doc: StudioDocument = {
      id: `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      token: newToken(),
      kind,
      number: nextNumber(documents, kind),
      projectId: projectId || undefined,
      prospectId: prefill?.prospectId,
      clientName: clientName.trim(),
      contactName: contactName.trim() || undefined,
      phone: prefill?.phone || project?.clientPhone,
      email: prefill?.email,
      items: clean.map(i => ({ description: i.description.trim(), quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) || 0 })),
      currency,
      issueDate: today,
      validUntil: kind === 'presupuesto' ? addDays(today, validDays) : undefined,
      notes: notes.trim() || undefined,
      paymentDate: kind === 'recibo' ? paymentDate : undefined,
      paymentMethod: kind === 'recibo' ? paymentMethod : undefined,
      paymentId: prefill?.paymentId,
      studioName: settings?.accountHolder ? `${STUDIO_NAME} · ${settings.accountHolder}` : STUDIO_NAME,
      paymentInfo: kind === 'presupuesto' ? paymentInfoFrom(settings, currency) : undefined,
      status: 'enviado',
      createdAt: new Date().toISOString(),
    };
    try {
      await saveDocument(doc);
      hapticFeedback.success();
      onSaved(doc);
    } catch (err) {
      setError(`No se guardó: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={kind === 'presupuesto' ? 'Nuevo presupuesto' : 'Nuevo recibo'}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[22px] sm:rounded-[22px] shadow-[var(--shadow-float)] p-5 space-y-4 max-h-[92vh] overflow-y-auto safe-area-pb t-sheet-enter"
      >
        <div className="flex items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Tipo" className="flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70">
            {(['presupuesto', 'recibo'] as DocumentKind[]).map(k => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  if (k === 'recibo' && notes === DEFAULT_NOTES) setNotes('');
                  if (k === 'presupuesto' && !notes) setNotes(DEFAULT_NOTES);
                }}
                className={`px-4 h-8 rounded-[8px] text-[14px] cursor-pointer ${kind === k ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)] font-medium'}`}
              >
                {k === 'presupuesto' ? 'Presupuesto' : 'Recibo'}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-[13px] font-semibold text-[var(--text-secondary)]">Cliente</label>
          <select value={projectId} onChange={e => pickProject(e.target.value)} aria-label="Elegir cliente" className={field}>
            <option value="">— Escribir a mano —</option>
            {clientOptions.map(p => (
              <option key={p.id} value={p.id}>
                {p.clientName}
                {p.isLead ? ' (posible)' : ''}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Estudio o empresa" aria-label="Nombre del cliente" className={field} />
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Persona de contacto" aria-label="Persona de contacto" className={field} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-[var(--text-secondary)]">Detalle</label>
            <select value={currency} onChange={e => setCurrency(e.target.value as 'ARS' | 'USD')} aria-label="Moneda" className="h-8 rounded-[8px] bg-[var(--bg-surface-muted)]/70 border-0 px-2 text-[13px]">
              <option value="USD">US$</option>
              <option value="ARS">$ (pesos)</option>
            </select>
          </div>
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-start">
              <textarea
                value={it.description}
                onChange={e => setItems(arr => arr.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                rows={1}
                placeholder={i === 0 ? (kind === 'presupuesto' ? 'Ej: Sitio web de 5 secciones' : 'Ej: Cuota 2 de 3') : 'Otro ítem'}
                aria-label={`Ítem ${i + 1}`}
                className={`${field} h-auto min-h-10 py-2 resize-y flex-1`}
              />
              <input
                inputMode="numeric"
                value={it.quantity}
                onChange={e => setItems(arr => arr.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value.replace(/\D/g, '')) || 1 } : x)))}
                aria-label="Cantidad"
                className={`${field} w-14 text-center`}
              />
              <input
                inputMode="decimal"
                value={it.unitPrice || ''}
                onChange={e => setItems(arr => arr.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } : x)))}
                placeholder="Importe"
                aria-label="Importe"
                className={`${field} w-28 tabular-nums`}
              />
              {items.length > 1 && (
                <button type="button" onClick={() => setItems(arr => arr.filter((_, j) => j !== i))} aria-label="Quitar ítem" className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--semantic-red)] cursor-pointer">
                  <Trash2 className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setItems(arr => [...arr, { description: '', quantity: 1, unitPrice: 0 }])} className="text-[14px] text-[var(--accent)] font-medium flex items-center gap-1 cursor-pointer">
              <Plus className="w-4 h-4" aria-hidden /> Agregar ítem
            </button>
            <p className="text-[17px] font-bold tabular-nums">
              Total {currency === 'USD' ? 'US$' : '$'} {total.toLocaleString('es-AR')}
            </p>
          </div>
        </div>

        {kind === 'presupuesto' ? (
          <div className="flex items-center gap-2">
            <label htmlFor="validez" className="text-[14px] text-[var(--text-secondary)]">Válido por</label>
            <select id="validez" value={validDays} onChange={e => setValidDays(Number(e.target.value))} className="h-9 rounded-[8px] bg-[var(--bg-surface-muted)]/70 border-0 px-2 text-[14px]">
              {[7, 15, 30].map(d => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} aria-label="Fecha del pago" className={field} />
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} aria-label="Forma de pago" className={field}>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="usdt">USDT</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="doc-notes" className="block text-[13px] font-semibold text-[var(--text-secondary)]">{kind === 'presupuesto' ? 'Condiciones' : 'Nota (opcional)'}</label>
          <textarea id="doc-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${field} h-auto py-2 resize-none`} />
          {kind === 'presupuesto' && <p className="text-[12px] text-[var(--text-tertiary)]">Se agregan solos tus datos de cobro (alias, CBU, link) de Ajustes.</p>}
        </div>

        {error && <p className="text-[14px] text-[var(--semantic-red)]">{error}</p>}
        <button type="submit" disabled={saving} className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-white text-[15px] font-semibold disabled:opacity-60 cursor-pointer t-press">
          {saving ? 'Creando…' : kind === 'presupuesto' ? 'Crear presupuesto y link' : 'Crear recibo y link'}
        </button>
      </form>
    </div>
  );
};
