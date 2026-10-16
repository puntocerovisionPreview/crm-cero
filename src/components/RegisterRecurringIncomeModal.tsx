import React, { useState } from 'react';
import { Project, RecurringIncomePlan, RecurringFrequency } from '../types';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated } from '../utils/sound';
import { X, Repeat, DollarSign, Calendar, Building2, FileText, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSaveRecurringPlan: (plan: RecurringIncomePlan, targetProjectId?: string) => void;
}

export const RegisterRecurringIncomeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projects,
  onSaveRecurringPlan,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [frequency, setFrequency] = useState<RecurringFrequency>('mensual');
  const [startDate, setStartDate] = useState(getTodayString());
  const [selectedProjectId, setSelectedProjectId] = useState<string>('none');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    hapticFeedback.success();
    playItemCreated();

    const linkedProj = projects.find(p => p.id === selectedProjectId);

    const newPlan: RecurringIncomePlan = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      amount: parsedAmount,
      currency,
      frequency,
      startDate,
      nextDueDate: startDate,
      active: true,
      projectId: linkedProj ? linkedProj.id : undefined,
      clientName: linkedProj ? linkedProj.clientName : undefined,
      notes: notes.trim() || undefined,
      createdAt: getTodayString(),
    };

    onSaveRecurringPlan(newPlan, linkedProj ? linkedProj.id : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Nuevo Abono / Ingreso Recurrente
              </h2>
              <p className="text-xs text-zinc-400">
                Registra un retainer mensual limpio sin crear clientes fantasma
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 pt-0 space-y-4 text-xs">
          {/* Título / Concepto */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>Concepto o Nombre del Abono *</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Mantenimiento Web, Retainer PAF, Asesoría Mensual"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Monto y Moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Monto Fijo *</span>
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                placeholder="Ej: 150000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300">Moneda</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`py-1 rounded-lg font-bold text-center transition cursor-pointer ${
                    currency === 'ARS'
                      ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ARS ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-1 rounded-lg font-bold text-center transition cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  USD (u$s)
                </button>
              </div>
            </div>
          </div>

          {/* Frecuencia y Fecha de Inicio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300">Frecuencia</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="mensual">Mensual (1 vez por mes)</option>
                <option value="quincenal">Quincenal (cada 15 días)</option>
                <option value="semanal">Semanal</option>
                <option value="bimestral">Bimestral</option>
                <option value="trimestral">Trimestral</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Fecha Inicio</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Cliente vinculado (Opcional) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Vincular a Cliente (Opcional)</span>
              </span>
              <span className="text-[10px] text-zinc-500">O dejar como ingreso libre</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="none">-- Ingreso Extra Libre del Estudio --</option>
              {projects.filter(p => !p.archived).map(p => (
                <option key={p.id} value={p.id}>
                  {p.clientName} ({p.serviceType?.toUpperCase() || 'CLIENTE'})
                </option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Notas u Observaciones</label>
            <input
              type="text"
              placeholder="Detalles del acuerdo o servicio prestado..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Botones */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-850">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Abono</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
