import { useEffect, useState } from 'react';
import { ContentPiece } from './model';
import { subscribeContent } from './store';

/** Piezas de contenido en vivo (null mientras carga) */
export function useContent() {
  const [pieces, setPieces] = useState<ContentPiece[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () =>
      subscribeContent(
        (items) => {
          setPieces(items);
          setError(null);
        },
        (err) => setError(err.message)
      ),
    []
  );
  return { pieces, error };
}
