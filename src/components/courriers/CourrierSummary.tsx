import { courrierReferences } from '../../utils/courrierReferences';
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faPaperclip, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { Courrier } from '../../types';

type Props={courrier:Courrier;objet:string;status:string;date:Date|string|undefined;urgent:boolean;highPriority:boolean;files:number;onOpen:()=>void;onDetails:()=>void;onFiles:()=>void};
export default function CourrierSummary({courrier,objet,status,date,urgent,highPriority,files,onOpen,onDetails,onFiles}:Props){
 const iso=typeof date==='string'?date.match(/^(\d{4})-(\d{2})-(\d{2})/):null;
 const parsed=date?new Date(date):null;const label=iso?`${iso[3]}/${iso[2]}/${iso[1]}`:parsed&&!Number.isNaN(parsed.getTime())?parsed.toLocaleDateString('fr-CD',{day:'2-digit',month:'short',year:'numeric'}):'Date non renseignée';
 return <div className={`courrier-summary ${courrier.isRead ? 'courrier-is-read' : 'courrier-is-unread'}`}><div className="courrier-summary-ref"><span>{courrierReferences(courrier)}</span><span className={`courrier-read-badge ${courrier.isRead ? 'is-read' : 'is-unread'}`} title={courrier.isRead ? 'Vous avez consulté ce courrier' : 'Vous n’avez pas encore consulté ce courrier'}>{courrier.isRead ? 'Lu' : 'Non lu'}</span>{(urgent||highPriority)&&<span className={urgent?'courrier-urgent':'courrier-high-priority'}>{urgent?'Urgent':'Prioritaire'}</span>}</div><button type="button" title={objet} className="courrier-summary-subject" onClick={e=>{e.stopPropagation();onOpen();}}>{objet}<FontAwesomeIcon icon={faArrowRight}/></button><div className="courrier-summary-meta"><span className="courrier-status">{status}</span><span>{label}</span></div><div className="courrier-mobile-correspondents"><CourrierCorrespondents courrier={courrier}/></div><div className="courrier-summary-tools"><button type="button" onClick={e=>{e.stopPropagation();onDetails();}}>Détails <FontAwesomeIcon icon={faChevronDown}/></button><button type="button" aria-label={`Documents du courrier ${courrierReferences(courrier)}`} onClick={e=>{e.stopPropagation();onFiles();}}><FontAwesomeIcon icon={faPaperclip}/>Pièces{files>0?` (${files})`:''}</button></div></div>;
}
export function CourrierCorrespondents({courrier}:{courrier:Courrier}){return <dl className="courrier-correspondents"><div><dt>De</dt><dd title={courrier.expediteur}>{courrier.expediteur||'Non renseigné'}</dd></div><div><dt>À</dt><dd title={courrier.destinataire}>{courrier.destinataire||'Non renseigné'}</dd></div></dl>;}
