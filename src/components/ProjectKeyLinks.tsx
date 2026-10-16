import React, { useState } from 'react';
import { ProjectKeyLink } from '../types';
import { 
  Link2, 
  ExternalLink, 
  Plus, 
  Trash2, 
  HardDrive, 
  Video, 
  Globe, 
  MapPin, 
  Instagram, 
  Megaphone, 
  FileText,
  Figma,
  Check
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  links?: ProjectKeyLink[];
  onUpdateLinks: (newLinks: ProjectKeyLink[]) => void;
  clientName: string;
}

export const ProjectKeyLinks: React.FC<Props> = ({
  links = [],
  onUpdateLinks,
  clientName,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<ProjectKeyLink['category']>('otro');

  // Auto detect category from URL
  const handleUrlChange = (value: string) => {
    setUrl(value);
    const low = value.toLowerCase();
    if (low.includes('drive.google.com')) setCategory('drive');
    else if (low.includes('figma.com')) setCategory('figma');
    else if (low.includes('facebook.com/adsmanager') || low.includes('adsmanager')) setCategory('meta');
    else if (low.includes('maps.google.com') || low.includes('google.com/maps') || low.includes('business.google.com')) setCategory('maps');
    else if (low.includes('instagram.com')) setCategory('instagram');
    else if (low.includes('youtube.com') || low.includes('vimeo.com') || low.includes('loom.com') || low.includes('frame.io')) setCategory('vsl');
    else if (low.startsWith('http://') || low.startsWith('https://')) setCategory('web');
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const defaultTitle = title.trim() || getDefaultTitleByCategory(category, clientName);

    const newLink: ProjectKeyLink = {
      id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: defaultTitle,
      url: finalUrl,
      category,
    };

    onUpdateLinks([...links, newLink]);
    setTitle('');
    setUrl('');
    setCategory('otro');
    setShowAddForm(false);
    hapticFeedback.success();
  };

  const handleDeleteLink = (id: string) => {
    onUpdateLinks(links.filter(l => l.id !== id));
    hapticFeedback.light();
  };

  const getIcon = (cat?: ProjectKeyLink['category']) => {
    switch (cat) {
      case 'drive':
        return <HardDrive className="w-4 h-4 text-amber-400" />;
      case 'figma':
        return <Figma className="w-4 h-4 text-purple-400" />;
      case 'meta':
        return <Megaphone className="w-4 h-4 text-blue-400" />;
      case 'maps':
        return <MapPin className="w-4 h-4 text-red-400" />;
      case 'instagram':
        return <Instagram className="w-4 h-4 text-pink-400" />;
      case 'vsl':
        return <Video className="w-4 h-4 text-emerald-400" />;
      case 'web':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      default:
        return <Link2 className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getDefaultTitleByCategory = (cat?: ProjectKeyLink['category'], name?: string) => {
    switch (cat) {
      case 'drive': return `Carpeta Drive (${name})`;
      case 'figma': return `Diseño Figma / UI`;
      case 'meta': return `Meta Ads Manager`;
      case 'maps': return `Ficha Google Maps`;
      case 'instagram': return `Instagram Estudio`;
      case 'vsl': return `VSL / Video Funnel`;
      case 'web': return `Web / Landing Page`;
      default: return `Enlace`;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-xs sm:text-sm font-bold text-zinc-200">
            Centro de Enlaces Clave ({links.length})
          </h3>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[var(--accent)] hover:text-[#ff691e] border border-zinc-800 text-xs font-semibold flex items-center gap-1 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Link</span>
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddLink} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
          <div className="text-xs font-semibold text-zinc-300">Nuevo Enlace Rápido</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Título (ej: Drive de Crudos, Meta Ads...)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)]"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="drive">Google Drive / Crudos</option>
              <option value="figma">Figma / Diseño</option>
              <option value="meta">Meta Ads / Campañas</option>
              <option value="maps">Google Business Profile / Maps</option>
              <option value="vsl">VSL / Video (Loom, YouTube, Vimeo)</option>
              <option value="web">Web / Landing Page</option>
              <option value="instagram">Instagram</option>
              <option value="otro">Otro Enlace</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Pega aquí la URL (https://...)"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)]"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setUrl(''); setTitle(''); }}
              className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[#ff691e] text-white text-xs font-bold transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Enlace</span>
            </button>
          </div>
        </form>
      )}

      {/* Links Grid */}
      {links.length === 0 ? (
        <div className="p-4 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800/80 text-center text-xs text-zinc-500">
          No hay enlaces guardados aún. Agrega la carpeta de Drive, ficha de Google Maps, Meta Ads o el VSL para tener todo a un clic.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="group p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-2 transition"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => hapticFeedback.light()}
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:text-[var(--accent)] transition"
                title={`Abrir ${link.url}`}
              >
                <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                  {getIcon(link.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-zinc-200 truncate group-hover:text-[var(--accent)] transition flex items-center gap-1.5">
                    <span>{link.title}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition shrink-0" />
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {link.url.replace(/^https?:\/\/(www\.)?/, '')}
                  </div>
                </div>
              </a>

              <button
                type="button"
                onClick={() => handleDeleteLink(link.id)}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-900 transition opacity-0 group-hover:opacity-100 shrink-0"
                title="Eliminar enlace"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
