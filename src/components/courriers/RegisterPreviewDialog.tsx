import React, {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

export default function RegisterPreviewDialog({children,onClose}:{children:React.ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDivElement>(null);
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  const root=document.getElementById('root');const inert=root?.inert;
  document.body.style.overflow='hidden';if(root)root.inert=true;
  ref.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],iframe,[tabindex="0"]')??[]);
    const first=nodes[0],last=nodes[nodes.length-1];
    if(!first){event.preventDefault();return;}
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;if(root)root.inert=inert??false;if(previous?.isConnected)previous.focus();};
 },[]);
 return createPortal(<div className="registry-preview-overlay" onClick={()=>close.current()}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Aperçu du cahier registre" className="registry-preview-dialog" onClick={event=>event.stopPropagation()}>{children}</div></div>,document.body);
}
