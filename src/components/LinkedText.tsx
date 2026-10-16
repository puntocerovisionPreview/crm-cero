import React from 'react';
import { extractWikiLinks, resolveEntityByTitle, LinkCatalogItem } from '../lib/links';
import { ArrowUpRight, AlertCircle } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  text: string;
  catalog: LinkCatalogItem[];
  onNavigate?: (path: string) => void;
  className?: string;
}

export const LinkedText: React.FC<Props> = ({
  text,
  catalog,
  onNavigate,
  className = '',
}) => {
  if (!text) return null;

  const parsedLinks = extractWikiLinks(text);

  if (parsedLinks.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  parsedLinks.forEach((link, i) => {
    // Text before the link
    if (link.startIndex > lastIndex) {
      elements.push(
        <span key={`text_${lastIndex}_${i}`}>
          {text.slice(lastIndex, link.startIndex)}
        </span>
      );
    }

    // Resolve the target entity
    const resolved = resolveEntityByTitle(link.targetTitle, catalog);

    if (resolved) {
      elements.push(
        <button
          key={`link_${link.startIndex}_${i}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            hapticFeedback.light();
            if (onNavigate) {
              onNavigate(resolved.path);
            } else if (typeof window !== 'undefined') {
              window.location.hash = `#${resolved.path}`;
            }
          }}
          className="inline-flex items-center gap-0.5 px-1 py-0.2 mx-0.5 rounded bg-[var(--bg-surface-muted)] hover:bg-[var(--solid-contrast-bg)] hover:text-[var(--solid-contrast-text)] text-[var(--text-primary)] border-b border-[var(--border-subtle)] hover:border-transparent transition text-xs font-mono font-medium cursor-pointer group"
          title={`Ir a ${resolved.title} (${resolved.type})`}
        >
          <span>{link.displayText}</span>
          <ArrowUpRight className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
        </button>
      );
    } else {
      // Broken link: Target does not exist or was deleted
      elements.push(
        <span
          key={`broken_${link.startIndex}_${i}`}
          className="inline-flex items-center gap-0.5 px-1 py-0.2 mx-0.5 rounded text-zinc-400 dark:text-zinc-600 border-b border-dashed border-zinc-400 dark:border-zinc-700 text-xs font-mono select-none"
          title="Elemento no encontrado (enlace roto)"
        >
          <AlertCircle className="w-2.5 h-2.5" />
          <span>{link.displayText}</span>
        </span>
      );
    }

    lastIndex = link.endIndex;
  });

  // Remaining text
  if (lastIndex < text.length) {
    elements.push(
      <span key={`text_end_${lastIndex}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <span className={className}>{elements}</span>;
};
