import React from 'react';
import { BarChart3, CalendarDays, FileText, Folder, Globe, Image, Instagram, Link2, MessageCircle, Palette, PlayCircle, Sheet, Video } from 'lucide-react';
import { accessIcon, type AccessIconKey } from '../portal/model';

const ICONS: Record<AccessIconKey, React.ElementType> = {
  drive: Folder,
  doc: FileText,
  sheet: Sheet,
  calendar: CalendarDays,
  web: Globe,
  instagram: Instagram,
  video: PlayCircle,
  design: Palette,
  chart: BarChart3,
  image: Image,
  chat: MessageCircle,
  meet: Video,
  link: Link2,
};

/** Ícono del acceso según lo que es (carpeta, calendario, web, Instagram…) */
export function AccessIcon({ nombre, url, className = 'w-4 h-4' }: { nombre: string; url?: string; className?: string }) {
  const Icon = ICONS[accessIcon(nombre, url)];
  return <Icon className={className} aria-hidden />;
}
