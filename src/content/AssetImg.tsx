import React from 'react';
import { useAssetUrl } from './assets';

/** Imagen guardada en Firestore (o una dirección común), con un recuadro mientras carga */
export const AssetImg: React.FC<{ src: string; alt?: string; className?: string }> = ({ src, alt = '', className }) => {
  const url = useAssetUrl(src);
  return url ? <img src={url} alt={alt} className={className} /> : <span className={`block animate-pulse bg-white/5 ${className || ''}`} aria-hidden />;
};
