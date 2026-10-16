import React, { useState } from 'react';
import { Project } from '../types';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated } from '../utils/sound';
import { X, Calendar, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSaveDates: (projectId: string, startDate: string, deliveryDate: string) => void;
}

export const AssignProjectDatesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  onSaveDates,
}) => {
  const today = getTodayString();
  const [startDate, setStartDate] = useState(project?.startDate || project?.horizonStart || today);
  const [deliveryDate, setDeliveryDate] = useState(project?.deliveryDate || project?.horizonEnd || today);

  if (!isOpen || !project) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !deliveryDate) return;
    hapticFeedback.success();
    playItemCreated();
    onSaveDates(project.id, startDate, deliveryDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl space-y-4">
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Asignar Fechas al Proyecto</h2>
              <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">{project.clientName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 pt-0 space-y-3.5 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Fecha de Inicio *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Fecha de Fin / Entrega *</label>
            <input
              type="date"
              required
              min={startDate}
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-850">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar en Gantt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
