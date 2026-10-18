import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { ModalPortal } from './ModalPortal';

const MOBILE_QUERY = '(max-width: 767px)';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

interface Props {
  onClose: () => void;
  /** Nombre del panel para lectores de pantalla */
  label: string;
  /** Clases del panel en escritorio (ancho, fondo, borde…) */
  className?: string;
  children: React.ReactNode;
}

// Modal que se adapta: en el celular es un panel que sube desde abajo (Vaul),
// se arrastra para cerrar y respeta el teclado; en escritorio, el diálogo centrado de siempre.
export const Sheet: React.FC<Props> = ({ onClose, label, className = '', children }) => {
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <Drawer.Root open onOpenChange={open => !open && onClose()} repositionInputs>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[9998] bg-black/60" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-[9999] max-h-[94dvh] flex flex-col rounded-t-[20px] bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] outline-none text-[var(--text-primary)]"
          >
            <Drawer.Title className="sr-only">{label}</Drawer.Title>
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)]" aria-hidden />
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain safe-area-pb">
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
        onMouseDown={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div role="dialog" aria-modal="true" aria-label={label} className={`my-auto t-modal-enter ${className}`} onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
};
