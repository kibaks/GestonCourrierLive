import type {Courrier} from '../types';
type Entity={id:string;nom:string;type:string;parentId?:string|null;actif?:boolean};
type Level={code:string;libelleSingulier:string};
export function internalEntityFields(type:string,emitter:Record<string,string>,recipient:Record<string,string>,levels:Level[],entities:Entity[]):Record<string,string>{
 if(type!=='INTERNE')return {};
 const fields:Record<string,string>={};
 for(const [side,cascade] of [['Emetteur',emitter],['Destinataire',recipient]] as const){
  fields['entite'+side+'Json']=JSON.stringify(cascade);
  fields['entite'+side+'Chemin']=levels.map(level=>{const entity=entities.find(e=>e.id===cascade[level.code]);return entity?level.libelleSingulier+' : '+entity.nom:'';}).filter(Boolean).join(' / ');
 }
 return fields;
}
export function internalEntityPath(courrier:Courrier,key:string,levels:Level[],entities:Entity[]):string{
 if(courrier.type!=='INTERNE'||!['expediteur','destinataire'].includes(key))return '';
 const side=key==='expediteur'?'Emetteur':'Destinataire',extra=courrier.extraFields as Record<string,unknown>|undefined;
 const saved=extra?.['entite'+side+'Chemin'];if(typeof saved==='string'&&saved)return saved;
 try{const raw=extra?.['entite'+side+'Json'];const cascade=typeof raw==='string'?JSON.parse(raw):raw;if(!cascade||typeof cascade!=='object')return '';return levels.map(level=>entities.find(e=>e.id===cascade[level.code])?.nom).filter(Boolean).join(' / ');}catch{return '';}
}
export function matchesInternalEntity(courrier:Courrier,id:string,entities:Entity[]):boolean{
 const root=entities.find(entity=>entity.id===id);
 if(!root)return courrier.direction===id;
 const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const e of entities)if(e.parentId&&ids.has(e.parentId)&&!ids.has(e.id)){ids.add(e.id);changed=true;}}
 const names=entities.filter(e=>ids.has(e.id)).map(e=>e.nom);
 if([courrier.direction,courrier.service,courrier.expediteur,courrier.destinataire].some(value=>!!value&&names.includes(value)))return true;
 for(const field of ['entiteEmetteurJson','entiteDestinataireJson'])try{const raw=(courrier.extraFields as Record<string,unknown>|undefined)?.[field];const cascade=typeof raw==='string'?JSON.parse(raw):raw;if(cascade&&typeof cascade==='object'&&Object.values(cascade).some(value=>typeof value==='string'&&ids.has(value)))return true;}catch{/* Old rows without a valid cascade retain their text fallback. */}
 return false;
}

export function cascadeForEntity(entityId:string,levels:Level[],entities:Entity[]):Record<string,string>{
 const result:Record<string,string>={},seen=new Set<string>();let entity=entities.find(e=>e.id===entityId);
 while(entity&&!seen.has(entity.id)){seen.add(entity.id);if(levels.some(level=>level.code===entity!.type))result[entity.type]=entity.id;entity=entities.find(e=>e.id===entity!.parentId);}
 return result;
}
