import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faArrowRight, faRightFromBracket, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import AuthShell from './auth/AuthShell';
import { AuthNotice, AuthPasswordField, SecurityCodeField } from './auth/AuthFields';
import { profileRequest } from '../services/profileService';

export default function LockScreen() {
  const {user,unlockWithPassword,completeSecureLogin,logout}=useAuth();const navigate=useNavigate();const root=useRef<HTMLDivElement>(null);
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[challenge,setChallenge]=useState(''),[code,setCode]=useState('');
  const [busy,setBusy]=useState(false),[recovery,setRecovery]=useState(false);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=root.current;const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab'||!dialog)return;const elements=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]'));if(!elements.length){e.preventDefault();dialog.focus();return;}const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};dialog?.addEventListener('keydown',trap);return()=>{dialog?.removeEventListener('keydown',trap);previous?.focus();};},[]);
  async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{if(challenge){const result=await profileRequest<{token:string}>('auth/two-factor',{challenge,code});await completeSecureLogin(result.token);}else if(!await unlockWithPassword(password))setError('Le mot de passe est incorrect. Réessayez pour reprendre votre session.');}catch(e){const failure=e as Error&{challenge?:string};if(failure.challenge){setChallenge(failure.challenge);setPassword('');}else setError(failure.message||'La vérification est momentanément indisponible.');}finally{setBusy(false);}}
  if(!user?.email)return null;
  return <div ref={root} tabIndex={-1} className="auth-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="lock-title"><AuthShell headingId="lock-title" eyebrow="Votre espace vous attend" title={challenge?'Vérifions que c’est vous.':'Une pause en toute sérénité.'} description={challenge?'Confirmez votre identité pour reprendre votre activité.':'Votre session est verrouillée. Identifiez-vous pour retrouver la page où vous étiez.'} icon={challenge?faShieldHalved:faLock}>
    <div className="auth-identity"><span>{user.nom?.slice(0,1).toUpperCase()||'U'}</span><div><strong>{user.nom}</strong><small>{user.email}</small></div><FontAwesomeIcon icon={faLock}/></div>
    {error&&<AuthNotice>{error}</AuthNotice>}<form className="auth-form" onSubmit={submit}><fieldset disabled={busy}>{challenge?<SecurityCodeField value={code} onChange={setCode} recovery={recovery}/>:<AuthPasswordField label="Mot de passe" value={password} onChange={setPassword} autoFocus/>}<button className="auth-submit" type="submit">{busy?'Vérification en cours…':challenge?'Vérifier et reprendre':'Déverrouiller mon espace'}{!busy&&<FontAwesomeIcon icon={faArrowRight}/>}</button></fieldset></form>
    {challenge&&<button type="button" disabled={busy} className="auth-back" onClick={()=>{setRecovery(v=>!v);setCode('');setError('');}}>{recovery?'Utiliser l’application d’authentification':'Utiliser un code de secours'}</button>}
    <button type="button" disabled={busy} className="auth-back" onClick={()=>{logout();navigate('/login',{replace:true});}}><FontAwesomeIcon icon={faRightFromBracket}/> Se connecter avec un autre compte</button>
    <div className="auth-bottom-note"><FontAwesomeIcon icon={faShieldHalved}/><p>Une protection pour votre session.<br/><span>Votre travail reprend après vérification.</span></p></div>
  </AuthShell></div>;
}
