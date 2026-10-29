/** Keep a stable request key for each draft line across retries. */
export function batchRequestId(keys:Record<string,string>,rowId:string,generate:()=>string):string {
 return keys[rowId] ||= generate();
}
/** Correlate by request id, never by subject: two letters can share an object. */
export function batchSourceRow<T extends {id:string}>(created:{clientRequestId?:string|null},rows:T[],keys:Record<string,string>,index:number):T|undefined {
 return created.clientRequestId ? rows.find(row=>keys[row.id]===created.clientRequestId) : rows[index];
}
