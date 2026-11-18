/** Stable API codes, displayed as the five business stages. */
export const courrierCycleStatuses = ['ENREGISTRE','ASSIGNE','EN_TRAITEMENT','TRAITE','ARCHIVE'] as const;
export const courrierStatusLabels: Record<string,string> = {
  ENREGISTRE:'En attente d’orientation', EN_ATTENTE_DG:'En attente d’orientation',
  ASSIGNE:'Orienté', ORIENTE_DG:'Orienté', ORIENTE_DIRECTEUR:'Orienté',
  EN_TRAITEMENT:'En traitement', TRAITE:'Traité', ARCHIVE:'Archivé',
};
export function courrierStatusLabel(status:string):string {return courrierStatusLabels[status] || status;}
export function courrierStatusGroup(status:string):string {
  if(status==='EN_ATTENTE_DG')return 'ENREGISTRE';
  if(status==='ORIENTE_DG'||status==='ORIENTE_DIRECTEUR')return 'ASSIGNE';
  return status;
}
export function matchesCourrierStatus(status:string,filter:string):boolean {return filter==='ALL'||courrierStatusGroup(status)===courrierStatusGroup(filter);}

export function canInitiallyOrient(status:string):boolean {return courrierStatusGroup(status)==='ENREGISTRE';}

/** Server-confirmed reception in the current direction, after upstream validations. */
export function canOrientListedCourrier(courrier: {statut:string;orientationAlreadyForwarded?:boolean;orientationPendingReception?:boolean;orientationAwaitingPreviousStep?:boolean}):boolean {
  return !courrier.orientationAlreadyForwarded && !courrier.orientationAwaitingPreviousStep
    && (canInitiallyOrient(courrier.statut) || courrier.orientationPendingReception === true);
}
