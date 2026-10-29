import BrandMark from '../BrandMark';
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faShieldHalved, faCheck, faArrowRight, faFolderOpen, faLock } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const stories = [
  { title: ['Vos correspondances.', 'Votre organisation.', 'Un même espace.'], description: 'Retrouvez vos documents, vos équipes et le fil de chaque échange dans un espace pensé pour votre quotidien.' },
  { title: ['Chaque document.', 'À la bonne place.', 'Au bon moment.'], description: 'Classez vos courriers par direction, retrouvez vos pièces jointes et gardez une référence claire pour chaque échange.' },
  { title: ['Des équipes reliées.', 'Des actions suivies.', 'Un travail partagé.'], description: 'Orientez les correspondances, consultez leur parcours et avancez ensemble jusqu’au traitement de chaque courrier.' },
];

type Props = {children:React.ReactNode;eyebrow:string;title:string;description:string;icon?:IconDefinition;headingId?:string};
export default function AuthShell({children,eyebrow,title,description,icon=faLock,headingId}:Props) {
  const [story, setStory] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || hidden) return;
    const timer = setInterval(() => setStory(current => (current + 1) % stories.length), 6500);
    return () => clearInterval(timer);
  }, [paused, reducedMotion, hidden, story]);
  return <div className="auth-scene"><header className="auth-topbar"><div className="auth-brand"><span className="gc-auth-mark"><BrandMark size={44}/></span><div>Gestion<span>Courriers</span><small>Votre espace professionnel · ARMP RDC</small></div></div><span className="auth-top-status"><FontAwesomeIcon icon={faShieldHalved}/> Accès sécurisé</span></header>
    <main className="auth-frame"><aside className="auth-presentation"><div className="auth-story-tag"><span/> LE COURRIER, SIMPLEMENT</div>
      <div className="auth-story-scenes" aria-label="Présentation de l’espace courrier">{stories.map((item,index)=><div key={item.title[0]} className={`auth-story-scene ${story===index?'is-active':''}`} aria-hidden={story!==index}>
        <div className="auth-story-stage"><div className="auth-story-copy"><h2>{item.title[0]}<br/><span>{item.title[1]}<br/>{item.title[2]}</span></h2><p>{item.description}</p></div></div>
        <div className={`auth-illustration auth-story-graphic auth-graphic-${index}`} aria-hidden="true"><div className="auth-illus-orbit"/>
          {index===0?<div className="auth-document auth-visual-card"><div className="auth-document-head"><span><FontAwesomeIcon icon={faEnvelope}/></span><div><b>Réception du courrier</b><small>Une référence, un document, une trace.</small></div><FontAwesomeIcon icon={faCheck}/></div><div className="auth-document-lines"><i/><i/><i/></div><div className="auth-document-steps"><span><FontAwesomeIcon icon={faCheck}/> Enregistrer</span><FontAwesomeIcon icon={faArrowRight}/><span><FontAwesomeIcon icon={faFolderOpen}/> Organiser</span></div></div>
          :index===1?<div className="auth-classify-card auth-visual-card"><div className="auth-visual-title"><FontAwesomeIcon icon={faFolderOpen}/><b>Un classement structuré</b></div><div className="auth-classify-tree"><div><FontAwesomeIcon icon={faFolderOpen}/><span>Direction générale</span></div><div><FontAwesomeIcon icon={faFolderOpen}/><span>Directions et services</span></div><div><FontAwesomeIcon icon={faEnvelope}/><span>Courriers et pièces jointes</span><FontAwesomeIcon icon={faCheck}/></div></div></div>
          :<div className="auth-tracking-card auth-visual-card"><div className="auth-visual-title"><FontAwesomeIcon icon={faShieldHalved}/><b>Chaque étape est suivie</b></div><div className="auth-tracking-steps">{['Enregistré','Orienté vers le service','Traitement en cours'].map((step,i)=><div key={step}><span>{i<2?<FontAwesomeIcon icon={faCheck}/>:<i/>}</span><b>{step}</b><small>{i<2?'Effectué':'En cours'}</small></div>)}</div><div className="auth-team-chips"><span>DG</span><span>DIR</span><span>SEC</span><small>Une équipe, un suivi partagé.</small></div></div>}
          <div className="auth-floating-seal"><FontAwesomeIcon icon={index===1?faFolderOpen:index===2?faCheck:faShieldHalved}/><span>{['Votre courrier','Vos documents','Votre équipe'][index]}<br/><b>{['en toute confiance','bien organisés','toujours informée'][index]}</b></span></div>
        </div><div className="auth-story-points"><span><FontAwesomeIcon icon={faCheck}/> {['Documents centralisés','Dossiers par direction','Parcours visible'][index]}</span><span><FontAwesomeIcon icon={faCheck}/> {['Références uniques','Pièces accessibles','Actions tracées'][index]}</span></div>
      </div>)}</div>
      <div className="auth-story-controls"><div role="group" aria-label="Scènes de présentation">{stories.map((item,index)=><button type="button" key={item.title[0]} aria-label={`Afficher la scène ${index+1} : ${item.title[0]}`} aria-pressed={story===index} onClick={()=>setStory(index)}><span/></button>)}</div>{!reducedMotion&&<button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?'Reprendre l’animation':'Suspendre l’animation'}</button>}</div>
    </aside>
      <section className="auth-panel" aria-labelledby={headingId || 'auth-heading'}><div className="auth-panel-icon"><FontAwesomeIcon icon={icon}/></div><p className="auth-eyebrow">{eyebrow}</p><h1 id={headingId || 'auth-heading'}>{title}</h1><p className="auth-description">{description}</p>{children}</section>
    </main><footer className="auth-footer"><span>GestionCourriers · ARMP RDC</span><span><FontAwesomeIcon icon={faLock}/> Un accès personnel, un suivi partagé.</span></footer></div>;
}
