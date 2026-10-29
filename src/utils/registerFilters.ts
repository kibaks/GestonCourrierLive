import type {Courrier} from '../types';
import {courrierSearchReferences} from './courrierReferences';
export interface RegisterSelection {
 filterSens:string;filterType:string;filterStatut:string;filterPriorite:string;
 filterDateDebut:string;filterDateFin:string;filterSearch:string;
 filterMesAssignations:boolean;filterNonClassifies:boolean;filterEntityId:string;
}
export function filterRegisterCourriers(rows:Courrier[],filters:RegisterSelection,assigned:Set<string>,entityMatches?:(row:Courrier,id:string)=>boolean):Courrier[]{
 const query=filters.filterSearch.trim().toLocaleLowerCase('fr');
 return rows.filter(row=>{
  const date=String(row.dateReception instanceof Date ? row.dateReception.toISOString() : row.dateReception||'').slice(0,10);
  return (filters.filterSens==='ALL'||row.sens===filters.filterSens)
   &&(filters.filterType==='ALL'||row.type===filters.filterType)
   &&(filters.filterStatut==='ALL'||row.statut===filters.filterStatut)
   &&(filters.filterPriorite==='ALL'||row.priorite===filters.filterPriorite)
   &&(!filters.filterDateDebut||date>=filters.filterDateDebut)
   &&(!filters.filterDateFin||date<=filters.filterDateFin)
   &&(!filters.filterMesAssignations||assigned.has(row.id))
   &&(!filters.filterNonClassifies||!row.categorieId)
   &&(filters.filterEntityId==='ALL'||(entityMatches?entityMatches(row,filters.filterEntityId):row.direction===filters.filterEntityId))
   &&(!query||[courrierSearchReferences(row),row.objet,row.expediteur,row.destinataire].some(value=>(value||'').toLocaleLowerCase('fr').includes(query)));
 });
}
