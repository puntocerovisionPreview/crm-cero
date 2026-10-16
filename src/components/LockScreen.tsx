import React, { useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface Props {
  onUnlock: () => void;
}

export const LockScreen: React.FC<Props> = ({ onUnlock }) => {
  const [digits, setDigits] = useState<string[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getStoredPin = () => {
    return localStorage.getItem('cero_lock_pin') || '0720';
  };

  const handleDigitPress = (digit: string) => {
    if (isShaking || digits.length >= 4) return;
    setErrorMsg(null);

    const updated = [...digits, digit];
    setDigits(updated);

    if (updated.length === 4) {
      const entered = updated.join('');
      const valid = getStoredPin();
      if (entered === valid) {
        onUnlock();
      } else {
        setIsShaking(true);
        setErrorMsg('PIN incorrecto');
        setTimeout(() => {
          setIsShaking(false);
          setDigits([]);
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    if (isShaking || digits.length === 0) return;
    setErrorMsg(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between items-center px-4 py-8 safe-area-pt safe-area-pb select-none overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex flex-col items-center pt-8 sm:pt-14">
        <BrandLogo size="md" className="mb-3" />
        <p className="text-xs text-[var(--text-secondary)] tracking-wide uppercase font-mono text-[10px]">
          CRM Personal .Cero
        </p>

        {/* 4 Swiss Minimalist Indicators */}
        <div
          className={`flex items-center gap-3 mt-8 transition-transform duration-150 ${
            isShaking ? 'translate-x-2' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = digits.length > idx;
            return (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full transition-all duration-150 ${
                  filled
                    ? 'bg-[var(--solid-contrast-bg)] scale-110'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <p className="text-xs text-[#DC2626] font-medium mt-4">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-[260px] pb-6 sm:pb-10">
        <div className="grid grid-cols-3 gap-y-3.5 gap-x-5 place-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigitPress(d)}
              className="w-16 h-16 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] active:scale-95 border border-[var(--border-subtle)] text-lg font-semibold text-[var(--text-primary)] font-mono flex items-center justify-center transition-all cursor-pointer shadow-xs"
            >
              {d}
            </button>
          ))}

          {/* Icon lock indicator */}
          <div className="w-16 h-16 flex items-center justify-center text-[var(--text-tertiary)]">
            <Lock className="w-4 h-4" />
          </div>

          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="w-16 h-16 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] active:scale-95 border border-[var(--border-subtle)] text-lg font-semibold text-[var(--text-primary)] font-mono flex items-center justify-center transition-all cursor-pointer shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={digits.length === 0}
            className="w-16 h-16 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
            title="Borrar"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
