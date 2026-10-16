import React from 'react';
import { LinkRelation, LinkCatalogItem, getBacklinksForEntity, LinkEntityType } from '../lib/links';
import { Link2, ArrowUpRight, FileText, CheckSquare, Building2, Briefcase, Calendar, Target, Zap } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  entityId: string;
  relations: LinkRelation[];
  catalog: LinkCatalogItem[];
  onNavigate?: (path: string) => void;
  className?: string;
}

export const BacklinksPanel: React.FC<Props> = ({
  entityId,
  relations,
  catalog,
  onNavigate,
  className = '',
}) => {
  const backlinks = getBacklinksForEntity(entityId, relations, catalog);

  if (backlinks.length === 0) {
    return (
      <div className={`p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)] ${className}`}>
        <div className="flex items-center gap-1.5 font-mono text-[11px] mb-1 text-[var(--text-secondary)]">
          <Link2 className="w-3.5 h-3.5" />
          <span>Sin menciones entrantes (Backlinks)</span>
        </div>
        <p className="text-[10px]">
          Escribe <code className="px-1 py-0.5 rounded bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-mono border border-[var(--border-subtle)]">[[Nombre]]</code> en cualquier nota o tarea para vincularla a este elemento.
        </p>
      </div>
    );
  }

  const getIcon = (type: LinkEntityType) => {
    switch (type) {
      case 'nota':
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
      case 'tarea':
        return <CheckSquare className="w-3.5 h-3.5 text-[#16A34A]" />;
      case 'proyecto':
        return <Building2 className="w-3.5 h-3.5 text-sky-400" />;
      case 'cliente':
        return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
      case 'reunion':
        return <Calendar className="w-3.5 h-3.5 text-orange-400" />;
      case 'objetivo':
        return <Target className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className={`p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between text-xs border-b border-[var(--border-divider)] pb-2">
        <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
          <Link2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="text-[11px] uppercase tracking-wider">Menciones & Backlinks</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
          {backlinks.length} {backlinks.length === 1 ? 'conexión' : 'conexiones'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {backlinks.map((bl, i) => (
          <button
            key={`bl_${bl.sourceId}_${i}`}
            type="button"
            onClick={() => {
              hapticFeedback.light();
              if (onNavigate) {
                onNavigate(bl.path);
              } else if (typeof window !== 'undefined') {
                window.location.hash = `#${bl.path}`;
              }
            }}
            className="text-left p-2 rounded-lg bg-[var(--bg-surface)] hover:border-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0">{getIcon(bl.sourceType)}</div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate group-hover:underline">
                  {bl.sourceTitle}
                </div>
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase font-mono">
                  {bl.isStructural ? 'Relación estructural' : bl.sourceType}
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] shrink-0 transition" />
          </button>
        ))}
      </div>
    </div>
  );
};
