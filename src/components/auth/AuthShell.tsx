import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faShieldHalved, faCheck, faArrowRight, faFolderOpen, faLock } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type Props = {children:React.ReactNode;eyebrow:string;title:string;description:string;icon?:IconDefinition;headingId?:string};
export default function AuthShell({children,eyebrow,title,description,icon=faLock,headingId}:Props) {
  return <div className="auth-scene"><header className="auth-topbar"><div className="auth-brand"><span><FontAwesomeIcon icon={faEnvelope}/></span><div>Gestion<span>Courriers</span><small>Votre espace professionnel · ARMP RDC</small></div></div><span className="auth-top-status"><FontAwesomeIcon icon={faShieldHalved}/> Accès sécurisé</span></header>
    <main className="auth-frame"><aside className="auth-presentation"><div className="auth-story-tag"><span/> LE COURRIER, SIMPLEMENT</div><h2>Vos correspondances.<br/><span>Votre organisation.<br/>Un même espace.</span></h2><p>Retrouvez vos documents, vos équipes et le fil de chaque échange dans un espace pensé pour votre quotidien.</p>
      <div className="auth-illustration" aria-hidden="true"><div className="auth-illus-orbit"/><div className="auth-document"><div className="auth-document-head"><span><FontAwesomeIcon icon={faEnvelope}/></span><div><b>Gestion du courrier</b><small>Chaque étape, bien suivie.</small></div><FontAwesomeIcon icon={faCheck}/></div><div className="auth-document-lines"><i/><i/><i/></div><div className="auth-document-steps"><span><FontAwesomeIcon icon={faCheck}/> Enregistrer</span><FontAwesomeIcon icon={faArrowRight}/><span><FontAwesomeIcon icon={faFolderOpen}/> Organiser</span></div></div><div className="auth-floating-seal"><FontAwesomeIcon icon={faShieldHalved}/><span>Votre suivi<br/><b>en toute confiance</b></span></div></div>
      <div className="auth-story-points"><span><FontAwesomeIcon icon={faCheck}/> Documents centralisés</span><span><FontAwesomeIcon icon={faCheck}/> Suivi partagé</span></div></aside>
      <section className="auth-panel" aria-labelledby={headingId || 'auth-heading'}><div className="auth-panel-icon"><FontAwesomeIcon icon={icon}/></div><p className="auth-eyebrow">{eyebrow}</p><h1 id={headingId || 'auth-heading'}>{title}</h1><p className="auth-description">{description}</p>{children}</section>
    </main><footer className="auth-footer"><span>GestionCourriers · ARMP RDC</span><span><FontAwesomeIcon icon={faLock}/> Un accès personnel, un suivi partagé.</span></footer></div>;
}
