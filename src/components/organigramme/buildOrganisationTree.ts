import type {OrganigrammeNode} from '../../services/organigrammeService';
import {EntiteOrganisationnelle,Utilisateur,Role} from '../../types';

/** Each configured unit appears once, under its actual parent; no inferred hierarchy. */
export function buildOrganisationTree(entities:EntiteOrganisationnelle[],users:Utilisateur[]):OrganigrammeNode[]{
 const units=new Map<string,OrganigrammeNode>();
 const ordered=entities.filter(e=>e.actif!==false).sort((a,b)=>(a.ordre||0)-(b.ordre||0)||a.nom.localeCompare(b.nom,'fr'));
 for(const entity of ordered)units.set(entity.id,{id:`ent-${entity.id}`,type:entity.type as OrganigrammeNode['type'],label:entity.nom,data:entity as unknown as OrganigrammeNode['data'],level:0,courrierRoles:entity.courrierRoles,children:[]});
 const roots:OrganigrammeNode[]=[];
 for(const entity of ordered){const node=units.get(entity.id)!;let ancestor=entity.parentId;const seen=new Set([entity.id]);let cycle=false;while(ancestor){if(seen.has(ancestor)){cycle=true;break;}seen.add(ancestor);ancestor=ordered.find(e=>e.id===ancestor)?.parentId;}const parent=!cycle&&entity.parentId?units.get(entity.parentId):undefined;if(parent)parent.children!.push(node);else roots.push(node);}
 for(const user of users){if(!user.actif||user.role===Role.SUPER_ADMIN||!user.entiteId)continue;const unit=units.get(user.entiteId);if(unit)unit.children!.push({id:`user-${user.id}`,type:'utilisateur',label:user.nom,role:user.role,data:user,level:0});}
 const levels=(items:OrganigrammeNode[],level:number)=>{for(const node of items){node.level=level;levels(node.children||[],level+1);}};levels(roots,0);return roots;
}
