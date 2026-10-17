import React, { useState } from 'react';
import { AgendaMeeting } from '../types';
import { 
  CalendarPlus, 
  CheckSquare, 
  DollarSign, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  MessageCircle,
  Clock,
  Sparkles,
  Award,
  Calendar
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { getTodayString, addDays } from '../utils/storage';

interface Props {
  isOpen: boolean;
  meeting: AgendaMeeting | null;
  onClose: () => void;
  onScheduleNextMeeting: (meeting: AgendaMeeting) => void;
  onCreateDerivedTask: (meeting: AgendaMeeting, nextActionText?: string, nextActionDate?: string) => void;
  onCreateDerivedIncome?: (meeting: AgendaMeeting) => void;
  onUpdateMeetingLeadScore?: (meetingId: string, score: 'A' | 'B' | 'C') => void;
}

export const PostMeetingCheckoutModal: React.FC<Props> = ({
  isOpen,
  meeting,
  onClose,
  onScheduleNextMeeting,
  onCreateDerivedTask,
  onCreateDerivedIncome,
  onUpdateMeetingLeadScore,
}) => {
  const [selectedScore, setSelectedScore] = useState<'A' | 'B' | 'C' | null>(null);
  const [nextAction, setNextAction] = useState('Enviar propuesta comercial y resumen');
  const [nextActionDate, setNextActionDate] = useState(() => addDays(getTodayString(), 1));

  if (!isOpen || !meeting) return null;

  const quickActionPresets = [
    'Enviar propuesta y link de seña',
    'Seguimiento por WhatsApp',
    'Enviar wireframes y alcance',
    'Coordinar reunión de kick-off',
  ];

  const handleScoreClick = (score: 'A' | 'B' | 'C') => {
    hapticFeedback.selection();
    setSelectedScore(score);
    if (onUpdateMeetingLeadScore) {
      onUpdateMeetingLeadScore(meeting.id, score);
    }
  };

  const handleCreateTask = () => {
    hapticFeedback.success();
    onCreateDerivedTask(meeting, nextAction, nextActionDate);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#121826] border border-[#263047] rounded-2xl shadow-2xl p-5 overflow-hidden relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#263047] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#34C38F]/15 border border-[#34C38F]/30 flex items-center justify-center text-[#34C38F]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#34C38F] block">
                Reunión Finalizada
              </span>
              <h3 className="text-sm font-bold text-[#E8ECF4] leading-tight">
                Check-out Post-Reunión
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8B95A9] hover:text-[#E8ECF4] hover:bg-[#1A2233] transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meeting Details */}
        <div className="p-3 rounded-xl bg-[#1A2233] border border-[#263047] mb-4">
          <p className="text-xs font-semibold text-[#E8ECF4] line-clamp-1">
            {meeting.title}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#8B95A9] font-mono">
            {meeting.time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#8B95A9]" />
                {meeting.time}
              </span>
            )}
            {meeting.clientPhone && (
              <span className="flex items-center gap-1 text-[#34C38F]">
                <MessageCircle className="w-3 h-3" />
                {meeting.clientPhone}
              </span>
            )}
          </div>
        </div>

        {/* 1. Lead Score Selector (1 tap) */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-[#8B95A9] mb-1.5">
            Calificación del Lead / Cliente:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleScoreClick('A')}
              className={`p-2 rounded-xl text-center border text-xs font-bold transition cursor-pointer ${
                selectedScore === 'A'
                  ? 'bg-[#34C38F]/20 text-[#34C38F] border-[#34C38F]'
                  : 'bg-[#1A2233] text-[#8B95A9] border-[#263047] hover:border-[#384666]'
              }`}
            >
              <div className="text-sm">🔥 Lead A</div>
              <div className="text-[10px] font-normal opacity-80">Listo p/ cerrar</div>
            </button>

            <button
              type="button"
              onClick={() => handleScoreClick('B')}
              className={`p-2 rounded-xl text-center border text-xs font-bold transition cursor-pointer ${
                selectedScore === 'B'
                  ? 'bg-[#4C8DFF]/20 text-[#4C8DFF] border-[#4C8DFF]'
                  : 'bg-[#1A2233] text-[#8B95A9] border-[#263047] hover:border-[#384666]'
              }`}
            >
              <div className="text-sm">⏱️ Lead B</div>
              <div className="text-[10px] font-normal opacity-80">A mediano plazo</div>
            </button>

            <button
              type="button"
              onClick={() => handleScoreClick('C')}
              className={`p-2 rounded-xl text-center border text-xs font-bold transition cursor-pointer ${
                selectedScore === 'C'
                  ? 'bg-[#EF5B5B]/20 text-[#EF5B5B] border-[#EF5B5B]'
                  : 'bg-[#1A2233] text-[#8B95A9] border-[#263047] hover:border-[#384666]'
              }`}
            >
              <div className="text-sm">❄️ Lead C</div>
              <div className="text-[10px] font-normal opacity-80">No califica</div>
            </button>
          </div>
        </div>

        {/* 2. Próxima acción rápida */}
        <div className="p-3 rounded-xl bg-[#1A2233] border border-[#263047] mb-4 space-y-2.5">
          <label className="block text-[11px] font-semibold text-[#8B95A9]">
            Próxima Acción Derivada (1 Tap):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="flex-1 bg-[#121826] border border-[#263047] rounded-xl px-3 py-1.5 text-xs text-[#E8ECF4] focus:outline-none focus:border-[#4C8DFF]"
            />
            <input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="bg-[#121826] border border-[#263047] rounded-xl px-2 py-1.5 text-xs text-[#E8ECF4] font-mono focus:outline-none focus:border-[#4C8DFF]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickActionPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setNextAction(preset)}
                className="text-[10px] px-2 py-1 rounded-lg bg-[#263047] text-[#8B95A9] hover:text-[#E8ECF4] transition"
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreateTask}
            className="w-full py-2 rounded-xl bg-[#4C8DFF] hover:bg-[#3B7BF0] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Crear Tarea Derivada</span>
          </button>
        </div>

        {/* 3. Action Buttons */}
        <div className="space-y-2 mb-4">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onScheduleNextMeeting(meeting);
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#1A2233] hover:bg-[#263047] border border-[#263047] text-left transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#8B7CF6]/20 text-[#8B7CF6] flex items-center justify-center">
                <CalendarPlus className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#E8ECF4]">
                Agendar Próxima Reunión / Control
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8B95A9]" />
          </button>

          {onCreateDerivedIncome && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                onCreateDerivedIncome(meeting);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#1A2233] hover:bg-[#263047] border border-[#263047] text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#34C38F]/20 text-[#34C38F] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[#E8ECF4]">
                  Registrar Cobro / Seña Acordada
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8B95A9]" />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#263047] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#263047] hover:bg-[#384666] text-[#8B95A9] hover:text-[#E8ECF4] text-xs font-semibold transition cursor-pointer"
          >
            Finalizar
          </button>
        </div>
      </div>
    </div>
  );
};
