import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowRight, faKey, faCircleCheck, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { profileRequest } from '../services/profileService';
import AuthShell from '../components/auth/AuthShell';
import { AuthNotice, AuthPasswordField } from '../components/auth/AuthFields';

export default function AccountRecovery({mode}:{mode:'request'|'reset'|'confirm'}) {
  const [params]=useSearchParams();
  const [email,setEmail]=useState(params.get('email')||''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const missingToken=mode!=='request'&&!params.get('token');
  const title=success?(mode==='request'?'Consultez votre messagerie.':mode==='reset'?'Un nouveau départ.':'Adresse confirmée.') : mode==='request'?'Un oubli, ça arrive.':mode==='reset'?'Votre nouveau mot de passe.':'Confirmez votre adresse.';
  const description=success?(mode==='request'?'Retrouvez les prochaines étapes dans votre boîte de réception.':'Vous pouvez maintenant retrouver votre espace de travail.') : mode==='request'?'Indiquez votre adresse de connexion pour recevoir un lien de réinitialisation.':mode==='reset'?'Choisissez un mot de passe personnel pour retrouver votre espace en toute confiance.':'Finalisez le changement d’adresse demandé depuis votre profil.';
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setError('');
    if(mode==='reset'&&password!==confirmation){setError('Les deux mots de passe ne correspondent pas.');return;}
    setBusy(true);
    try {let result:{message:string};if(mode==='request')result=await profileRequest('auth/forgot-password',{email:email.trim()});else if(mode==='reset')result=await profileRequest('auth/reset-password',{email:email.trim(),password,password_confirmation:confirmation,token:params.get('token')});else result=await profileRequest('profile/confirm-email',{token:params.get('token')});setSuccess(result.message);setPassword('');setConfirmation('');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <AuthShell eyebrow={mode==='confirm'?'Vérification du compte':'Récupération de votre accès'} title={title} description={description} icon={success?faCircleCheck:mode==='request'?faEnvelope:mode==='confirm'?faShieldHalved:faKey}>
    <ol className="auth-steps" aria-label="Étapes de récupération">{(mode==='confirm'?['Demande','Confirmation']:['Adresse e-mail','Nouveau mot de passe']).map((label,i)=><li key={label} aria-current={!success&&i===(mode==='request'?0:1)?'step':undefined} className={success||i===(mode==='request'?0:1)?'current':''}><span>{success?<FontAwesomeIcon icon={faCircleCheck}/>:i+1}</span>{label}</li>)}</ol>
    {error&&<AuthNotice>{error}</AuthNotice>}
    {missingToken&&!success?<AuthNotice>Ce lien est incomplet. {mode==='reset'?<Link to="/mot-de-passe-oublie">Demandez un nouveau lien de réinitialisation.</Link>:'Ouvrez le lien reçu par e-mail pour confirmer votre adresse.'}</AuthNotice>:success?<><AuthNotice success>{success}</AuthNotice>{mode==='request'&&<div className="auth-help-card"><strong>Vous ne trouvez pas l’e-mail ?</strong><p>Vérifiez vos courriers indésirables et l’adresse saisie. Si nécessaire, contactez votre administrateur.</p><button type="button" onClick={()=>{setSuccess('');setError('');}}>Corriger mon adresse</button></div>}</>:<form onSubmit={submit} className="auth-form"><fieldset disabled={busy}>{mode!=='confirm'&&<label className="auth-label" htmlFor="recovery-email">Adresse e-mail<span className="auth-input-wrap"><FontAwesomeIcon icon={faEnvelope}/><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@organisation.cd"/></span></label>}{mode==='reset'&&<><AuthPasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} autoComplete="new-password" minLength={8}/><p className="auth-field-help">8 caractères minimum. Privilégiez une phrase que vous seul connaissez.</p><AuthPasswordField label="Confirmer le mot de passe" value={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={8}/></>}<button className="auth-submit" type="submit">{busy?'Traitement en cours…':mode==='request'?'Recevoir le lien':mode==='reset'?'Enregistrer le mot de passe':'Confirmer mon adresse'}{!busy&&<FontAwesomeIcon icon={faArrowRight}/>}</button></fieldset></form>}
    <Link to="/login" className="auth-back">← Retour à la connexion</Link>
  </AuthShell>;
}
