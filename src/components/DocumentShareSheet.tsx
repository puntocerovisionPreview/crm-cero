import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Mail, MessageCircle, PenLine, X } from 'lucide-react';
import { StudioDocument, docTitle, documentUrl, sendForSignature, shareMessage } from '../utils/documents';
import { whatsappLink } from '../utils/coldClients';
import { hapticFeedback } from '../utils/haptics';
import { getAuthHeaders } from '../utils/authAccess';
import { Sheet } from './Sheet';

interface Props {
  doc: StudioDocument | null;
  title?: string;
  onClose: () => void;
}

// Después de crear un presupuesto o recibo: mandarlo por WhatsApp, mail, a firmar o copiar el link
export const DocumentShareSheet: React.FC<Props> = ({ doc, title, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [signing, setSigning] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [signError, setSignError] = useState<string | null>(null);
  if (!doc) return null;
  const signStatus = signing === 'sent' ? 'pendiente' : doc.signature?.status;

  const sendToSign = async () => {
    setSigning('sending');
    setSignError(null);
    try {
      await sendForSignature(doc, await getAuthHeaders());
      setSigning('sent');
      hapticFeedback.success();
    } catch (err) {
      setSigning('idle');
      setSignError((err as Error).message);
    }
  };
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
    <Sheet label={title || `${docTitle(doc)} listo`} onClose={onClose} className="w-full sm:max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] shadow-[var(--shadow-float)]">
      <div className="p-4 space-y-3">
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
          {doc.kind === 'presupuesto' && (
            <li>
              <button
                type="button"
                onClick={sendToSign}
                disabled={signing === 'sending' || Boolean(signStatus)}
                className={`${row} disabled:cursor-default disabled:hover:bg-transparent`}
              >
                <span className={icon('bg-[#171717] dark:bg-[#3A3A3A]')}>
                  {signing === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : signStatus === 'firmado' ? <Check className="w-4 h-4" aria-hidden /> : <PenLine className="w-4 h-4" aria-hidden />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block">
                    {signStatus === 'firmado'
                      ? 'Firmado'
                      : signStatus === 'rechazado'
                        ? 'Rechazó la firma'
                        : signStatus === 'pendiente'
                          ? 'Enviado a firmar'
                          : signing === 'sending'
                            ? 'Enviando a firmar…'
                            : 'Enviar a firmar (Documenso)'}
                  </span>
                  <span className={`block text-[12px] ${signError ? 'text-[var(--semantic-red)]' : 'text-[var(--text-tertiary)]'}`}>
                    {signError || (signStatus === 'pendiente' ? `Le llegó un mail a ${doc.email}` : doc.email ? `Le llega un mail a ${doc.email}` : 'Falta el mail del cliente')}
                  </span>
                </span>
              </button>
            </li>
          )}
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
    </Sheet>
  );
};
