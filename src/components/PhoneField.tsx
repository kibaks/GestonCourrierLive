import React, { useRef } from 'react';

export function normalizePhone(value: string): string {
  const source = value.trim().replace(/^00/, '+');
  const digits = source.replace(/\D/g, '').slice(0, 15);
  return source.startsWith('+') ? `+${digits}` : digits;
}
export function formatPhone(value: string): string {
  const clean = normalizePhone(value);
  if (clean.startsWith('+243')) {
    const rest = clean.slice(4);
    return ['+243', rest.slice(0, 2), rest.slice(2, 5), rest.slice(5)].filter(Boolean).join(' ');
  }
  return clean.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {value:string;onValueChange:(value:string)=>void};
/** Display separators only; the API receives a normalized international number. */
export default function PhoneField({value, onValueChange, ...props}:Props) {
  const ref = useRef<HTMLInputElement>(null);
  const change = (raw:string, caret:number) => {
    const count = raw.slice(0, caret).replace(/[^\d+]/g, '').length;
    const clean = normalizePhone(raw);
    onValueChange(clean);
    requestAnimationFrame(() => {
      const input = ref.current;
      if (!input || document.activeElement !== input) return;
      let position=0, seen=0;
      while(position<input.value.length && seen<count) { if(/[\d+]/.test(input.value[position])) seen++;position++; }
      input.setSelectionRange(position, position);
    });
  };
  return <input {...props} ref={ref} type="tel" inputMode="tel" autoComplete="tel" value={formatPhone(value)} maxLength={22} placeholder={props.placeholder || '+243 81 234 5678'} onChange={e=>change(e.target.value,e.target.selectionStart??e.target.value.length)} onKeyDown={e=>{
    const input=e.currentTarget, caret=input.selectionStart??0;
    if(e.key==='Backspace' && caret===input.selectionEnd && caret>0 && input.value[caret-1]===' ') {
      e.preventDefault();change(input.value.slice(0,caret-2)+input.value.slice(caret),caret-2);
    }
  }} />;
}
