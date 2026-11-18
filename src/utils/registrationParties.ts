import type { ExtraFieldConfig, FormStructure } from '../services/formulaireCourrierService';
import { cascadeForEntity } from './internalEntities';
import type { EntiteOrganisationnelle, Utilisateur } from '../types';

type Level = {code:string;libelleSingulier:string};
export function registrationSender(user: Pick<Utilisateur,'nom'|'entiteId'|'direction'> | null | undefined, entities: EntiteOrganisationnelle[], levels: Level[]) {
  let entity = entities.find(item=>item.actif!==false && item.id===user?.entiteId);
  const seen = new Set<string>();
  while (entity && !['direction','direction_generale'].includes(entity.type) && !seen.has(entity.id)) {
    seen.add(entity.id);entity=entities.find(item=>item.actif!==false && item.id===entity?.parentId);
  }
  entity ??= entities.find(item=>item.actif!==false && ['direction','direction_generale'].includes(item.type) && (item.nom===user?.direction || item.id===user?.direction));
  return {name:user?.nom || '',entity,cascade:entity?cascadeForEntity(entity.id,levels,entities):{}};
}

/** The account supplies the sender; the published layout supplies the other fields. */
export function registrationSections(sections: FormStructure): FormStructure {
  if (!sections.length) return sections;
  const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const sender=(field:ExtraFieldConfig)=>/expediteur|emetteur|sender/.test(norm(field.name+' '+field.label));
  const recipient=(field:ExtraFieldConfig)=>/destinataire|recipient|recepteur/.test(norm(field.name+' '+field.label));
  let hasRecipient=false;
  const result=sections.map(section=>({...section,columns:section.columns.map(column=>({...column,fields:column.fields.filter(field=>!sender(field)).flatMap(field=>{
    if(!recipient(field))return [field];
    if(hasRecipient)return [];
    hasRecipient=true;return [{...field,name:'destinataire',required:true}];
  })}))}));
  if (!hasRecipient) {
    const recipient: ExtraFieldConfig={id:'registration-recipient',name:'destinataire',label:'Destinataire',type:'text',required:true};
    const first=result[0];
    if(first.columns.length)first.columns[0].fields=[recipient,...first.columns[0].fields];
    else first.columns=[{id:'registration-parties',width:12,fields:[recipient]}];
  }
  return result;
}
