import React, {useEffect, useRef, useState} from 'react';
import {profileRequest} from '../../services/profileService';

type Options={requiresDgAnnotation:boolean;targets:{id:string;nom:string;role:string}[];instructions:{id:string;contenu:string;fichierId:string;page?:number}[]};
export default function CourrierOrientationPanel({courrierId,onChanged,revision}:{courrierId:string;revision:number;onChanged:()=>Promise<unknown>}) {
  const [options,setOptions]=useState<Options|null>(null),[target,setTarget]=useState(''),[annotation,setAnnotation]=useState(''),[instructions,setInstructions]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const pending=useRef(false);
  useEffect(()=>{let active=true;setOptions(null);setTarget('');setAnnotation('');setError('');setNotice('');
    profileRequest<Options>(`courriers/${courrierId}/orientation-options`).then(value=>{if(active){setOptions(value);if(value.targets.length===1)setTarget(value.targets[0].id);}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[courrierId,revision]);
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');
    try{await profileRequest('assignations',{courrierId,assigneA:target,dgAnnotationId:annotation||undefined,instructions});await onChanged();setNotice('Courrier transmis. Le destinataire et le secrétariat concerné sont informés.');}
    catch(e){setError(e instanceof Error?e.message:'Transmission impossible.');}
    finally{pending.current=false;setBusy(false);}
  }
  if(!options)return error?<p role="alert">{error}</p>:null;
  if(!options.targets.length)return null;
  return <form className="workflow-circuit-setup" onSubmit={submit} aria-label="Orientation du courrier">
    <h3>Orienter le courrier</h3>
    <p>{options.requiresDgAnnotation?'Affectez le traitement en vous appuyant sur les instructions annotées par le DG.':'Transmettez le courrier au responsable de votre secrétariat.'}</p>
    <fieldset disabled={busy} className="workflow-step-actions">
      <label htmlFor="orientation-target">Destinataire</label>
      <select id="orientation-target" required value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choisir le responsable</option>{options.targets.map(person=><option key={person.id} value={person.id}>{person.nom}</option>)}</select>
      {options.requiresDgAnnotation&&<><label htmlFor="orientation-instruction">Instruction du DG dans le document</label><select id="orientation-instruction" required value={annotation} onChange={e=>setAnnotation(e.target.value)}><option value="">Choisir l’annotation de référence</option>{options.instructions.map(item=><option key={item.id} value={item.id}>{item.contenu.slice(0,160)}{item.page?' · page '+item.page:''}</option>)}</select>{annotation&&<blockquote>{options.instructions.find(item=>item.id===annotation)?.contenu}</blockquote>}{!options.instructions.length&&<p>Aucune instruction du DG sur le document. Son annotation est nécessaire avant l’affectation.</p>}</>}
      <label htmlFor="orientation-notes">Consignes de transmission</label><textarea id="orientation-notes" rows={2} maxLength={20000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Précisez l’action attendue sans modifier les instructions du DG."/>
      <button type="submit" disabled={busy||!target||(options.requiresDgAnnotation&&!annotation)}>{busy?'Transmission…':'Confirmer l’orientation'}</button>
    </fieldset>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </form>;
}
