import React, { useState, useMemo } from 'react';
import { LinkCatalogItem, LinkRelation, LinkEntityType } from '../lib/links';
import { KnowledgeGraphCanvas } from './KnowledgeGraphCanvas';
import { Network, ChevronRight } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  entityId: string;
  catalog: LinkCatalogItem[];
  relations: LinkRelation[];
  onNavigate?: (path: string) => void;
  privacyMode?: boolean;
}

export const LocalGraphWidget: React.FC<Props> = ({
  entityId,
  catalog,
  relations,
  onNavigate,
  privacyMode,
}) => {
  const [depth, setDepth] = useState<1 | 2>(1);

  // Filter catalog and relations to local neighborhood of entityId at depth 1 or 2
  const { localCatalog, localRelations } = useMemo(() => {
    const includedIds = new Set<string>();
    includedIds.add(entityId);

    // Depth 1: direct neighbors
    relations.forEach(r => {
      if (r.sourceId === entityId) includedIds.add(r.targetId);
      if (r.targetId === entityId) includedIds.add(r.sourceId);
    });

    // Depth 2: neighbors of neighbors
    if (depth === 2) {
      const depth1Ids = Array.from(includedIds);
      relations.forEach(r => {
        if (depth1Ids.includes(r.sourceId)) includedIds.add(r.targetId);
        if (depth1Ids.includes(r.targetId)) includedIds.add(r.sourceId);
      });
    }

    const filteredCatalog = catalog.filter(c => includedIds.has(c.id));
    const filteredRelations = relations.filter(
      r => includedIds.has(r.sourceId) && includedIds.has(r.targetId)
    );

    return { localCatalog: filteredCatalog, localRelations: filteredRelations };
  }, [entityId, catalog, relations, depth]);

  const neighborCount = localCatalog.length - 1;

  return (
    <div className="card-swiss p-3.5 space-y-2.5">
      <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-2.5">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Grafo Local
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
            {neighborCount} {neighborCount === 1 ? 'vecino' : 'vecinos'}
          </span>
        </div>

        {/* Depth Selector & Full Graph link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[10px]">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setDepth(1);
              }}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                depth === 1 
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Prof. 1
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setDepth(2);
              }}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                depth === 2 
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Prof. 2
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              if (onNavigate) onNavigate('/grafo');
            }}
            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-0.5 transition cursor-pointer underline"
          >
            <span>Ver global</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {neighborCount === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[var(--border-subtle)] rounded-xl">
          <p className="text-xs text-[var(--text-tertiary)]">Sin conexiones directas aún.</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Usa <code className="px-1 py-0.5 rounded bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-mono border border-[var(--border-subtle)]">[[...]]</code> en las notas para conectar este elemento.
          </p>
        </div>
      ) : (
        <KnowledgeGraphCanvas
          catalog={localCatalog}
          relations={localRelations}
          onNavigate={onNavigate}
          height="280px"
          focusNodeId={entityId}
          privacyMode={privacyMode}
        />
      )}
    </div>
  );
};
