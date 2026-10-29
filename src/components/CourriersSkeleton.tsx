import React from 'react';

type Props = { mode?: 'liste' | 'arborescence'; showCreate?: boolean };
const Placeholder = ({ className = '' }: { className?: string }) => <span className={`courrier-placeholder ${className}`} />;

export default function CourriersSkeleton({ mode = 'liste', showCreate = false }: Props) {
 return <div className="courrier-layout-skeleton" role="status" aria-live="polite" aria-label="Chargement des courriers">
  <span className="sr-only">Chargement des courriers…</span>
  <div aria-hidden="true">
   <div className="courrier-skeleton-header">
    <div className="courrier-skeleton-heading"><div className="courrier-skeleton-title"><Placeholder className="sk-icon"/><div><Placeholder className="sk-title"/><Placeholder className="sk-count"/></div></div><div className="courrier-skeleton-view"><Placeholder className="sk-search"/><Placeholder className="sk-switch"/></div></div>
    <div className="courrier-skeleton-tools"><div><Placeholder className="sk-tool"/><Placeholder className="sk-tool-small"/></div><div><Placeholder className="sk-tool-small"/><Placeholder className="sk-tool-small"/></div></div>
    <div className="courrier-skeleton-stats"><Placeholder className="sk-stat-label"/><Placeholder className="sk-stat-count"/></div>
   </div>
   <div className="courrier-skeleton-table">
    <div className="courrier-skeleton-help"><Placeholder className="sk-help"/></div>
    <div className="courrier-skeleton-columns"><Placeholder className="sk-column-name"/><Placeholder className="sk-column-correspondents"/><Placeholder className="sk-checkbox"/></div>
    <div className={`courrier-skeleton-group ${mode==='arborescence'?'is-folder':''}`}><Placeholder className="sk-folder-icon"/><Placeholder className="sk-group-title"/><Placeholder className="sk-count"/></div>
    {Array.from({length:6},(_,index)=><div className={`courrier-skeleton-row ${mode==='arborescence'?'is-nested':''}`} key={index}>
     <div className="courrier-skeleton-subject"><div className="sk-reference"><Placeholder className="sk-number"/><Placeholder className="sk-badge"/></div><Placeholder className={`sk-subject-line ${index%2?'shorter':''}`}/><div className="sk-mobile-meta"><Placeholder className="sk-badge"/><Placeholder className="sk-date"/></div><div className="sk-mobile-correspondents"><Placeholder/><Placeholder/></div><div className="sk-row-tools"><Placeholder/><Placeholder/></div></div>
     <div className="courrier-skeleton-meta"><Placeholder className="sk-badge"/><Placeholder className="sk-date"/></div>
     <div className="courrier-skeleton-correspondents"><Placeholder/><Placeholder/></div>
     <div className="courrier-skeleton-actions"><Placeholder className="sk-checkbox"/><Placeholder className="sk-menu"/></div>
    </div>)}
   </div>
   <div className="courrier-skeleton-pagination"><Placeholder className="sk-page-summary"/><div><Placeholder className="sk-page-size"/><Placeholder className="sk-page-controls"/></div></div>
   {showCreate&&<Placeholder className="courrier-skeleton-create"/>}
  </div>
 </div>;
}
