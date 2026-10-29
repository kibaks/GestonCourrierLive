import { profileRequest } from './profileService';
export type RegisterMode='arrivee'|'depart'|'transmission';
export type RegisterRow={id:string;courrierId:string;canEdit:boolean;fileCount:number;[key:string]:string|number|boolean|null};
export type RegisterData={items:RegisterRow[];pagination:{page:number;pages:number;total:number;perPage:number};counts:Record<RegisterMode,number>;units:string[]};
export type RegisterFilters={mode:RegisterMode;q:string;unit:string;from:string;to:string;page:number;per_page:number};
export function getRegister(filters:RegisterFilters,signal?:AbortSignal):Promise<RegisterData>{const params=new URLSearchParams();Object.entries(filters).forEach(([key,value])=>{if(value!==''&&value!=null)params.set(key,String(value));});return profileRequest(`workspace/registre?${params}`,undefined,'GET',signal);}
export function saveRegister(row:RegisterRow,mode:RegisterMode,fields:Record<string,string|null>){return profileRequest(`workspace/registre/${row.courrierId}`,{...fields,...(mode==='transmission'?{assignmentId:row.id}:{})},'PUT');}
export type RegisterColumn={key:string;label:string;width:number};
export const registerTitles:Record<RegisterMode,string>={arrivee:'Registre du courrier arrivé',depart:'Registre du courrier départ',transmission:'Registre de transmission interne'};
const refs: RegisterColumn[]=[{key:'organisationReference',label:'N° administratif',width:27}];
export const registerColumns:Record<RegisterMode,RegisterColumn[]>={
 arrivee:[{key:'receivedAt',label:'Réception',width:19},{key:'registeredAt',label:'Inscription',width:19},...refs,{key:'originalReference',label:'Référence d’origine',width:25},{key:'originalDate',label:'Date du document',width:19},{key:'sender',label:'Expéditeur',width:30},{key:'subject',label:'Objet',width:52},{key:'attachments',label:'Annexes',width:21},{key:'unit',label:'Service destinataire',width:30},{key:'notes',label:'Suite / Observations',width:30}],
 depart:[{key:'registeredAt',label:'Inscription',width:19},{key:'signedAt',label:'Signature',width:19},{key:'dispatchedAt',label:'Expédition',width:19},...refs,{key:'unit',label:'Service émetteur',width:28},{key:'recipient',label:'Destinataire',width:32},{key:'subject',label:'Objet',width:52},{key:'attachments',label:'Annexes',width:20},{key:'signatory',label:'Signataire',width:24},{key:'dispatchChannel',label:'Envoi',width:19},{key:'receiptAt',label:'Réception confirmée',width:20},{key:'receiptReference',label:'Preuve / Référence AR',width:28},{key:'notes',label:'Observations',width:28}],
 transmission:[{key:'transmittedAt',label:'Transmission',width:24},...refs,{key:'subject',label:'Objet',width:48},{key:'assignedBy',label:'Transmis par',width:30},{key:'assignedTo',label:'Affectataire',width:30},{key:'unit',label:'Direction / Service',width:28},{key:'instructions',label:'Instructions',width:40},{key:'deadline',label:'Échéance',width:20},{key:'transmissionReceiptAt',label:'Remise confirmée',width:22},{key:'transmissionReceiptReference',label:'Preuve de remise',width:28},{key:'transmissionNotes',label:'Observations',width:30}]
};
export function registerValue(row:RegisterRow,key:string):string{
 const value=row[key];
 if(key==='attachments'){const description=typeof value==='string'?value.trim():'';return description||(row.fileCount>0?`${row.fileCount} fichier(s) enregistré(s)`:'');}
 if(value===null||value===undefined||value==='')return '';
 if(['receivedAt','registeredAt','originalDate','signedAt','dispatchedAt','receiptAt','transmittedAt','deadline','transmissionReceiptAt'].includes(key)){
  const date=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);return date?`${date[3]}/${date[2]}/${date[1]}`:'';
 }
 if(key==='dispatchChannel')return ({PORTEUR:'Porteur',POSTE:'Poste',EMAIL:'Email',WHATSAPP:'WhatsApp',AUTRE:'Autre'} as Record<string,string>)[String(value)]||String(value);
 return String(value);
}
