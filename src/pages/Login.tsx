import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faEnvelope, faRightToBracket, faShieldHalved, faKey } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { profileRequest } from '../services/profileService';
import AuthShell from '../components/auth/AuthShell';
import { AuthNotice, AuthPasswordField, SecurityCodeField } from '../components/auth/AuthFields';

export default function Login() {
  const {login,completeSecureLogin}=useAuth(); const navigate=useNavigate();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState(''),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[recovery,setRecovery]=useState(false);
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try {
      if(challenge){const result=await profileRequest<{token:string}>('auth/two-factor',{challenge,code});await completeSecureLogin(result.token);navigate('/dashboard',{replace:true});}
      else if(await login(email.trim(),password))navigate('/dashboard',{replace:true});
      else setError('L’adresse ou le mot de passe est incorrect. Vérifiez vos informations et réessayez.');
    } catch(e) {const failure=e as Error & {challenge?:string};if(failure.challenge){setChallenge(failure.challenge);setPassword('');setCode('');}else setError(failure.message||'La connexion est momentanément indisponible. Veuillez réessayer.');}
    finally {setBusy(false);}
  }
  return <AuthShell eyebrow={challenge?'Vérification en deux étapes':'Heureux de vous retrouver'} title={challenge?'Un dernier contrôle.':'Bienvenue chez vous.'} description={challenge?'Confirmez votre identité pour ouvrir votre espace professionnel.':'Connectez-vous pour retrouver vos courriers et poursuivre votre activité.'} icon={challenge?faShieldHalved:faRightToBracket}>
    {challenge&&<div className="auth-identity"><span>{email.slice(0,1).toUpperCase()}</span><div><small>Compte à vérifier</small><strong>{email}</strong></div></div>}
    {error&&<AuthNotice>{error}</AuthNotice>}
    <form onSubmit={submit} className="auth-form"><fieldset disabled={busy}>{challenge?<SecurityCodeField value={code} onChange={setCode} recovery={recovery}/>:<><label className="auth-label" htmlFor="login-email">Adresse e-mail<span className="auth-input-wrap"><FontAwesomeIcon icon={faEnvelope}/><input id="login-email" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@organisation.cd"/></span></label><AuthPasswordField label="Mot de passe" value={password} onChange={setPassword}/><div className="auth-form-options"><span><FontAwesomeIcon icon={faShieldHalved}/> Compte professionnel</span><Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link></div></>}<button className="auth-submit" type="submit">{busy?'Vérification en cours…':challenge?'Vérifier et continuer':'Se connecter'}{!busy&&<FontAwesomeIcon icon={faArrowRight}/>}</button></fieldset></form>
    {challenge?<div className="auth-secondary-actions"><button type="button" disabled={busy} onClick={()=>{setRecovery(v=>!v);setCode('');setError('');}}><FontAwesomeIcon icon={faKey}/>{recovery?'Utiliser l’application d’authentification':'Utiliser un code de secours'}</button><button type="button" disabled={busy} onClick={()=>{setChallenge('');setCode('');setError('');setRecovery(false);}}>← Revenir à la connexion</button></div>:<div className="auth-bottom-note"><FontAwesomeIcon icon={faShieldHalved}/><p>Votre accès est personnel.<br/><span>Utilisez le compte transmis par votre administrateur.</span></p></div>}
  </AuthShell>;
}
