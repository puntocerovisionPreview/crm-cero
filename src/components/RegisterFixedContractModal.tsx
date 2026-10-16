import React, { useState, useEffect } from 'react';
import { Project, RecurringFrequency, PaymentMethod } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { getTodayString } from '../utils/storage';
import { X, Handshake, Calendar, DollarSign, Repeat, ShieldCheck, User } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaveContract: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const RegisterFixedContractModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaveContract,
}) => {
  const [clientName, setClientName] = useState('Ingreso Extra Mensual');
  const [ownerName, setOwnerName] = useState('Acuerdo Directo');
  const [clientPhone, setClientPhone] = useState('');
  const [amount, setAmount] = useState<string>('150000');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [frequency, setFrequency] = useState<RecurringFrequency>('mensual');
  const [dueDay, setDueDay] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [notes, setNotes] = useState('Ingreso extra recurrente de un servicio o acuerdo especial que no realizo habitualmente.');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.max(0, parseFloat(amount) || 0);
    if (!clientName.trim() || parsedAmount <= 0) return;

    hapticFeedback.success();

    // Calculate deliveryDate / horizonEnd based on durationMonths
    const [y, m, d] = startDate.split('-').map(Number);
    const endTarget = new Date(y, m - 1 + durationMonths, d);
    const endYear = endTarget.getFullYear();
    const endMonth = String(endTarget.getMonth() + 1).padStart(2, '0');
    const endDay = String(Math.min(d, new Date(endYear, endTarget.getMonth() + 1, 0).getDate())).padStart(2, '0');
    const calculatedDeliveryDate = `${endYear}-${endMonth}-${endDay}`;

    // Generate monthly recurring commitments for the next durationMonths
    const generatedCommitments: any[] = [];
    const generatedInstallments: any[] = [];

    for (let i = 0; i < durationMonths; i++) {
      const cDate = new Date(y, m - 1 + i, dueDay || d);
      const cYear = cDate.getFullYear();
      const cMonth = String(cDate.getMonth() + 1).padStart(2, '0');
      const cDay = String(dueDay || d).padStart(2, '0');
      const formattedDate = `${cYear}-${cMonth}-${cDay}`;

      const title = `Abono Mes ${i + 1} (${frequency})`;
      const id = `rec_cmt_${Date.now()}_${i + 1}`;

      generatedCommitments.push({
        id,
        title,
        dueDate: formattedDate,
        amount: parsedAmount,
        currency,
        status: 'pendiente',
        paid: false,
        notes: `Cobro programado de ingreso extra: ${clientName}`,
      });

      generatedInstallments.push({
        id: `inst_${id}`,
        number: i + 1,
        totalInstallments: durationMonths,
        title,
        dueDate: formattedDate,
        expectedAmount: parsedAmount,
        actualPaidAmount: 0,
        currency,
        status: 'futuro',
      });
    }

    const totalContractAmount = parsedAmount * durationMonths;

    onSaveContract({
      clientName: clientName.trim(),
      ownerName: ownerName.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      status: 'En curso',
      serviceType: 'otro',
      projectType: 'otro',
      frente: 'Otros',
      isLead: false,
      rubro: 'Ingreso Extra Recurrente',
      montoAcordado: totalContractAmount,
      estimatedPrice: parsedAmount, // Valor recurrente mensual
      estimatedCurrency: currency,
      notes: notes.trim(),
      archived: false,
      startDate,
      deliveryDate: calculatedDeliveryDate,
      horizonStart: startDate,
      horizonEnd: calculatedDeliveryDate,
      cupos: 0, // No satura la capacidad operativa técnica si es un ingreso extra externo
      paymentCommitments: generatedCommitments,
      recurringPlans: [
        {
          id: `plan_${Date.now()}`,
          title: `Ingreso Extra ${clientName}`,
          amount: parsedAmount,
          currency,
          frequency,
          startDate,
          nextDueDate: generatedCommitments[0]?.dueDate || startDate,
          active: true,
          clientName: clientName.trim(),
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
      billingAgreement: {
        id: `agr_contrato_${Date.now()}`,
        type: 'retainer',
        title: `Ingreso Extra Recurrente - ${clientName}`,
        currency,
        monthlyAmount: parsedAmount,
        totalAmount: totalContractAmount,
        installmentsCount: durationMonths,
        startDate,
        endDate: calculatedDeliveryDate,
        dueDayRule: dueDay,
        notes: notes.trim(),
        installments: generatedInstallments,
      },
    });

    onClose();
  };

  return (
    <ModalPortal>
      <div 
        className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 md:p-6 flex min-h-full items-start sm:items-center justify-center animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div 
          className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-2rem)] overflow-hidden animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Pinned & Never Cut Off */}
          <div className="shrink-0 p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                <Handshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Registrar Ingreso Extra Recurrente</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">
                    Ingreso Extra
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Para ingresos extra fijos, asesorías externas o acuerdos recurrentes que suman a tu meta
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition cursor-pointer shrink-0"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body with Scrollable Area & Pinned Footer */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Nombre y Contacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block">
                    Nombre / Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="ej: Asesoría Externa / Servicio Especial"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block">
                    Titular / Contacto
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="ej: Nombre del contacto o comitente"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Monto y Moneda */}
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Valor del Cobro Recurrente</span>
                  </span>
                  <span className="text-[11px] text-zinc-400">Suma a la proyección de 3 meses</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-medium">Monto por período *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-zinc-400 font-bold">
                        {currency === 'USD' ? 'US$' : '$'}
                      </span>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="150000"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 font-medium">Moneda</label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setCurrency('ARS')}
                        className={`py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
                          currency === 'ARS' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        $ Pesos (ARS)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
                          currency === 'USD' ? 'bg-violet-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        US$ Dólares
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Frecuencia, Día de Cobro y Duración */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Frecuencia</span>
                  </label>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as RecurringFrequency)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Día de cobro del mes</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={e => setDueDay(parseInt(e.target.value, 10) || 10)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block">
                    Duración del pacto
                  </label>
                  <select
                    value={durationMonths}
                    onChange={e => setDurationMonths(parseInt(e.target.value, 10) || 3)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value={3}>3 meses (Horizonte corto)</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses (1 año)</option>
                  </select>
                </div>
              </div>

              {/* Fecha de Inicio y WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block">
                    Fecha primer cobro
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold block">
                    Teléfono / WhatsApp (opcional)
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="+54 9 11 ..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-semibold block">
                  Notas y detalles del acuerdo
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Detalle sobre el contrato o condiciones acordadas..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-violet-500 resize-none text-xs"
                />
              </div>

              {/* Resumen de impacto */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-zinc-300">
                <div>
                  <span className="text-[11px] text-zinc-500 block">Ingreso mensual proyectado</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {currency === 'USD' ? 'US$ ' : '$ '}
                    {(parseFloat(amount) || 0).toLocaleString('es-AR')} {currency} / mes
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-500 block">Total en {durationMonths} meses</span>
                  <span className="text-xs font-mono font-semibold text-zinc-200">
                    {currency === 'USD' ? 'US$ ' : '$ '}
                    {((parseFloat(amount) || 0) * durationMonths).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Pinned Sticky Footer - Always Visible */}
            <div className="shrink-0 p-3 sm:p-4 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition cursor-pointer font-medium text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition shadow-lg shadow-violet-600/25 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Handshake className="w-4 h-4" />
                <span>Registrar Ingreso Extra</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
