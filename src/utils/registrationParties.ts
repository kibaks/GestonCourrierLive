import type { ExtraFieldConfig, FormStructure } from '../services/formulaireCourrierService';
import { cascadeForEntity } from './internalEntities';
import type { EntiteOrganisationnelle, Utilisateur } from '../types';

type Level = {code:string;libelleSingulier:string};
export function registrationSender(user: Pick<Utilisateur,'nom'|'entiteId'|'direction'> | null | undefined, entities: EntiteOrganisationnelle[], levels: Level[]) {
  let entity = entities.find(item=>item.actif!==false && item.id===user?.entiteId);
  entity ??= entities.find(item=>item.actif!==false && ['direction','direction_generale'].includes(item.type) && (item.nom===user?.direction || item.id===user?.direction));
  return {name:entity?.nom || '',entity,cascade:entity?cascadeForEntity(entity.id,levels,entities):{}};
}

/** The direction of the letter determines which party is entered in the published layout. */
export function registrationSections(sections: FormStructure, sens = 'SORTANT', type = 'EXTERNE'): FormStructure {
  if (!sections.length) return sections;
  const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const sender=(field:ExtraFieldConfig)=>/expediteur|emetteur|sender/.test(norm(field.name+' '+field.label));
  const recipient=(field:ExtraFieldConfig)=>/destinataire|recipient|recepteur/.test(norm(field.name+' '+field.label));
  if (sens === 'ENTRANT') {
    const configuredSender = sections.some(section => section.columns.some(column => column.fields.some(sender)));
    let hasSender = false;
    const result = sections.map(section => ({...section, columns: section.columns.map(column => ({...column, fields: column.fields.flatMap(field => {
      if (!sender(field) && !recipient(field)) return [field];
      if (hasSender || (configuredSender && !sender(field))) return [];
      hasSender = true;
      return [{...field, name:'expediteur', label:type === 'INTERNE' ? 'Entité interne expéditrice' : 'Organisation expéditrice', type:'text' as const, required:true, placeholder:type === 'INTERNE' ? 'Choisissez l’entité interne expéditrice' : 'Nom de l’organisation externe expéditrice'}];
    })}))}));
    if (!hasSender && result[0].columns.length) result[0].columns[0].fields.unshift({id:'registration-sender',name:'expediteur',label:type === 'INTERNE' ? 'Entité interne expéditrice' : 'Organisation expéditrice',type:'text',required:true});
    return result;
  }
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

export function internalRegistrationIssue(sender:Pick<EntiteOrganisationnelle,'id'|'nom'|'type'>|undefined,recipient:Pick<EntiteOrganisationnelle,'id'|'nom'|'type'>|undefined):string|undefined {
  if(!sender||!recipient)return;
  if(sender.id===recipient.id)return `${sender.nom} est déjà l’entité expéditrice. Choisissez une autre entité destinataire : une entité ne peut pas s’adresser un courrier à elle-même.`;
  if(sender.type!=='direction_generale'&&recipient.type!=='direction_generale')return 'Les courriers internes circulent uniquement entre la Direction Générale et une autre entité. Choisissez la Direction Générale comme destinataire.';
}

export function externalIncomingRecipient(type:string,sens:string,entities:EntiteOrganisationnelle[],accountEntity?:EntiteOrganisationnelle):EntiteOrganisationnelle|undefined {
  if(type!=='EXTERNE'||sens!=='ENTRANT')return;
  if(accountEntity?.actif!==false&&accountEntity?.type==='direction_generale')return accountEntity;
  return entities.find(entity=>entity.actif!==false&&entity.type==='direction_generale'&&entity.nom==='Direction Générale');
}

/** Direction-originating letters are always addressed to their own DG ancestor. */
export function lockedRegistrationRecipient(type:string,sens:string,entities:EntiteOrganisationnelle[],accountEntity?:EntiteOrganisationnelle):EntiteOrganisationnelle|undefined {
  const incoming=sens==='ENTRANT' ? externalIncomingRecipient('EXTERNE',sens,entities,accountEntity) : undefined;
  if(incoming)return incoming;
  if(type!=='INTERNE'||!accountEntity||accountEntity.actif===false)return;
  let current:EntiteOrganisationnelle|undefined=accountEntity;
  const seen=new Set<string>();let direction=false;
  while(current&&!seen.has(current.id)){
    seen.add(current.id);
    if(current.type==='direction')direction=true;
    if(current.type==='direction_generale')return direction?current:undefined;
    current=entities.find(entity=>entity.actif!==false&&entity.id===current?.parentId);
  }
}
