/** Keep a stable request key for each draft line across retries. */
export function batchRequestId(keys:Record<string,string>,rowId:string,generate:()=>string):string {
 return keys[rowId] ||= generate();
}
/** Correlate by request id, never by subject: two letters can share an object. */
export function batchSourceRow<T extends {id:string}>(created:{clientRequestId?:string|null},rows:T[],keys:Record<string,string>,index:number):T|undefined {
 return created.clientRequestId ? rows.find(row=>keys[row.id]===created.clientRequestId) : rows[index];
}
/** Capture the visible context at submission time, even before draft effects flush. */
export function batchContextRow<T extends {type:string;sens:string}>(row:T,context:Pick<T,'type'|'sens'>):T {
 return {...row,type:context.type,sens:context.sens};
}

export function batchRegistrationFailure(error:unknown):string {
 const reason=error instanceof Error?error.message:typeof error==='string'?error:'';
 if(/failed to fetch|networkerror|network request failed/i.test(reason))return 'Connexion à l’API interrompue. Votre saisie est conservée ; réessayez lorsque la connexion revient.';
 return reason.trim() || 'Enregistrement impossible. Réessayez ou consultez le détail de la ligne.';
}
