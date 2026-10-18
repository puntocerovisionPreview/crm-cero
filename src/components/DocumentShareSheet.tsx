import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Mail, MessageCircle, X } from 'lucide-react';
import { StudioDocument, docTitle, documentUrl, shareMessage } from '../utils/documents';
import { whatsappLink } from '../utils/coldClients';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  doc: StudioDocument | null;
  title?: string;
  onClose: () => void;
}

// Después de crear un presupuesto o recibo: mandarlo por WhatsApp, mail o copiar el link
export const DocumentShareSheet: React.FC<Props> = ({ doc, title, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!doc) return null;
  const url = documentUrl(doc.token);
  const msg = shareMessage(doc, url);
  const wa = whatsappLink(doc.phone);
  const waHref = `${wa || 'https://wa.me/'}?text=${encodeURIComponent(msg)}`;
  const mailHref = `mailto:${doc.email || ''}?subject=${encodeURIComponent(`${docTitle(doc)} · ${doc.studioName}`)}&body=${encodeURIComponent(msg)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      hapticFeedback.success();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copiá el link:', url);
    }
  };

  const row = 'w-full min-h-[50px] px-4 flex items-center gap-3 text-left text-[16px] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-surface-muted)]/50';
  const icon = (bg: string) => `w-8 h-8 rounded-[9px] flex items-center justify-center text-white shrink-0 ${bg}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[22px] sm:rounded-[22px] shadow-[var(--shadow-float)] p-4 space-y-3 safe-area-pb t-sheet-enter"
      >
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h3 id="share-title" className="text-[17px] font-semibold text-[var(--text-primary)]">{title || `${docTitle(doc)} listo`}</h3>
            <p className="text-[13px] text-[var(--text-secondary)]">{doc.clientName} · mandale el link</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        <ul className="rounded-[14px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
          <li>
            <a href={waHref} target="_blank" rel="noopener noreferrer" className={row} onClick={() => hapticFeedback.light()}>
              <span className={icon('bg-[#25D366]')}><MessageCircle className="w-4 h-4" aria-hidden /></span>
              WhatsApp{wa ? '' : ' (elegís el contacto)'}
            </a>
          </li>
          <li>
            <a href={mailHref} className={row}>
              <span className={icon('bg-[#007AFF]')}><Mail className="w-4 h-4" aria-hidden /></span>
              Mail
            </a>
          </li>
          <li>
            <button type="button" onClick={copy} className={row}>
              <span className={icon('bg-[#8E8E93]')}>{copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}</span>
              {copied ? 'Link copiado' : 'Copiar link'}
            </button>
          </li>
          <li>
            <a href={url} target="_blank" rel="noopener noreferrer" className={row}>
              <span className={icon('bg-[#5856D6]')}><ExternalLink className="w-4 h-4" aria-hidden /></span>
              Ver como lo ve el cliente (y PDF)
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};
