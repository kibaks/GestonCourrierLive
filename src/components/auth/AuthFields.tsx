import React, { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faCircleExclamation, faCircleCheck } from '@fortawesome/free-solid-svg-icons';

type PasswordProps = {label:string;value:string;onChange:(value:string)=>void;autoComplete?:string;minLength?:number;autoFocus?:boolean};
export function AuthPasswordField({label,value,onChange,autoComplete='current-password',minLength,autoFocus}:PasswordProps) {
  const [visible,setVisible]=useState(false); const id=useId();
  return <label className="auth-label" htmlFor={id}>{label}<span className="auth-input-wrap"><FontAwesomeIcon icon={faLock}/><input id={id} required type={visible?'text':'password'} autoComplete={autoComplete} minLength={minLength} autoFocus={autoFocus} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" aria-label={`${visible?'Masquer':'Afficher'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}><FontAwesomeIcon icon={visible?faEyeSlash:faEye}/></button></span></label>;
}
export function AuthNotice({children,success=false}:{children:React.ReactNode;success?:boolean}) {return <div role={success?'status':'alert'} className={`auth-notice ${success?'success':''}`}><FontAwesomeIcon icon={success?faCircleCheck:faCircleExclamation}/><div>{children}</div></div>;}
export function SecurityCodeField({value,onChange,recovery=false}:{value:string;onChange:(value:string)=>void;recovery?:boolean}) {
  const id=useId();
  return <div><label className="auth-label" htmlFor={id}>{recovery?'Code de secours':'Code de vérification'}</label>{recovery?<input className="auth-plain-input auth-recovery-code" id={id} required autoFocus autoComplete="one-time-code" maxLength={32} value={value} onChange={e=>onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''))}/>:<div className="auth-otp"><input id={id} required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={value} onChange={e=>onChange(e.target.value.replace(/\D/g,'').slice(0,6))}/><div aria-hidden="true" className="auth-otp-boxes">{Array.from({length:6},(_,i)=><span className={i===Math.min(value.length,5)?'active':''} key={i}>{value[i]||'·'}</span>)}</div></div>}<p className="auth-field-help">{recovery?'Chaque code de secours ne peut être utilisé qu’une seule fois.':'Saisissez les 6 chiffres de votre application d’authentification.'}</p></div>;
}
