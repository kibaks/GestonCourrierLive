import React, { useId } from 'react';

type Props = { size?: number; animated?: boolean; className?: string; label?: string };
/** One vector identity shared by navigation, authentication and loading states. */
export default function BrandMark({ size = 44, animated = false, className = '', label }: Props) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 96 96" width={size} height={size} className={`gc-mark ${animated ? 'gc-mark-animated' : ''} ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
    <defs><linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1e3a8a"/><stop offset="1" stopColor="#2563eb"/></linearGradient></defs>
    <rect x="2" y="2" width="92" height="92" rx="25" fill={`url(#${id}-blue)`}/>
    <path d="M15 33V26a11 11 0 0 1 11-11h7M81 63v7a11 11 0 0 1-11 11h-7" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="2" strokeLinecap="round"/>
    <path d="m18 44 26-18a7 7 0 0 1 8 0l26 18-30 24Z" fill="#a8c5ff"/>
    <g className="gc-mark-paper"><path d="M32 19h23l11 11v36H28V23a4 4 0 0 1 4-4Z" fill="#fff"/><path d="M55 19v8a3 3 0 0 0 3 3h8" fill="#d7e5ff"/>
      <g className="gc-mark-lines" fill="none" stroke="#4678d9" strokeWidth="3" strokeLinecap="round"><path d="M36 34h14"/><path d="M36 42h22"/><path d="M36 50h17"/></g>
    </g>
    <path d="M18 44v26a7 7 0 0 0 7 7h46a7 7 0 0 0 7-7V44L51 62a5 5 0 0 1-6 0Z" fill="#edf4ff"/>
    <path d="m19 72 20-15m38 15L57 57" fill="none" stroke="#b2c9f3" strokeWidth="2" strokeLinecap="round"/>
    <g className="gc-mark-seal"><circle cx="73" cy="73" r="13" fill="#2563eb" stroke="#fff" strokeWidth="3"/><path className="gc-mark-check" d="m67 73 4 4 8-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>
  </svg>;
}
