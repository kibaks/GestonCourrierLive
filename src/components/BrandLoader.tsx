import React from 'react';
import BrandMark from './BrandMark';

export default function BrandLoader({ label = 'Chargement de votre espace…', fullPage = false, compact = false }: { label?: string; fullPage?: boolean; compact?: boolean }) {
  return <div className={`gc-loader ${fullPage ? 'gc-loader-page' : ''} ${compact ? 'gc-loader-compact' : ''}`} role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
    <div className="gc-loader-symbol"><BrandMark size={compact ? 64 : 96} animated/></div>
    {!compact && <div className="gc-loader-wordmark">Gestion<span>Courriers</span><small>Chaque courrier, bien suivi.</small></div>}
    <p>{label}</p><div className="gc-loader-track" aria-hidden="true"><span/></div>
  </div>;
}
