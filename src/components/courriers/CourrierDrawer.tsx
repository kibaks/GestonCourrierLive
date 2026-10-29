import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = { title: string; description?: string; onClose: () => void; children: React.ReactNode; busy?: boolean; wide?: boolean; headerActions?: React.ReactNode };
export default function CourrierDrawer({title,description,onClose,children,busy=false,wide=false,headerActions}:Props){
 const titleId=useId();const descriptionId=useId();const panel=useRef<HTMLDivElement>(null);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;const root=document.getElementById('root');const wasInert=root?.inert;
  document.body.style.overflow='hidden';if(root)root.inert=true;
  const focusable=()=>Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')??[]).filter(node=>node.getClientRects().length>0);
  (panel.current?.querySelector<HTMLElement>('[data-drawer-autofocus]')??focusable()[0]??panel.current)?.focus();
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close.current();}if(event.key==='Tab'){const items=focusable();const first=items[0];const last=items[items.length-1];if(!first){event.preventDefault();panel.current?.focus();}else if(event.shiftKey&&(document.activeElement===first||!panel.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!panel.current?.contains(document.activeElement))){event.preventDefault();first.focus();}}};
  document.addEventListener('keydown',keyboard,true);
  return()=>{document.removeEventListener('keydown',keyboard,true);document.body.style.overflow=overflow;if(root)root.inert=wasInert??false;if(previous?.isConnected)previous.focus();};
 },[]);
 return createPortal(<div className="courrier-drawer-layer"><div className="courrier-drawer-backdrop" onClick={()=>{if(!busy)onClose();}}/><div ref={panel} className={`courrier-drawer ${wide ? 'courrier-drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} tabIndex={-1}><header className="courrier-drawer-header"><div><span className="courrier-drawer-eyebrow">Gestion des courriers</span><h2 id={titleId}>{title}</h2>{description&&<p id={descriptionId}>{description}</p>}</div><div className="courrier-drawer-header-actions">{headerActions}<button type="button" className="courrier-drawer-close" aria-label="Fermer le panneau" disabled={busy} onClick={onClose}>×</button></div></header>{children}</div></div>,document.body);
}
