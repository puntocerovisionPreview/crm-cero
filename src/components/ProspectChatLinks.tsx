import React from 'react';
import { Instagram, MessageCircle } from 'lucide-react';
import { Prospect } from '../types';
import { normalizeInstagram } from '../prospecting/core';
import { formatWhatsAppUrl } from '../utils/contact';

/**
 * "Abrir chat": lleva directo a la conversación con el prospecto (sin mensaje escrito),
 * para revisar si respondió sin tener que buscarlo en WhatsApp o Instagram.
 */
export const ProspectChatLinks: React.FC<{ p: Prospect; size?: 'sm' | 'lg' }> = ({ p, size = 'sm' }) => {
  const ig = p.instagram ? normalizeInstagram(p.instagram) : '';
  if (!p.whatsapp && !ig) return null;
  const cls =
    size === 'lg'
      ? 'h-11 px-4 rounded-[12px] text-[14px] font-semibold inline-flex items-center justify-center gap-2 border transition active:scale-[0.98]'
      : 'h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 border transition active:scale-95';
  return (
    <div className={`flex flex-wrap gap-2 ${size === 'lg' ? '[&>a]:flex-1' : ''}`}>
      {p.whatsapp && (
        <a
          href={formatWhatsAppUrl(p.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${cls} border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10`}
          title={`Abrir el chat con ${p.studio || p.name} (${p.whatsapp})`}
        >
          <MessageCircle className={size === 'lg' ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} /> Abrir chat en WhatsApp
        </a>
      )}
      {ig && (
        <a
          href={`https://ig.me/m/${ig}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${cls} border-[#E1306C]/40 text-[#E1306C] hover:bg-[#E1306C]/10`}
          title={`Abrir los mensajes con @${ig}`}
        >
          <Instagram className={size === 'lg' ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} /> {p.whatsapp ? 'Instagram' : 'Abrir chat en Instagram'}
        </a>
      )}
    </div>
  );
};
