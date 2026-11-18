/** Keep server responses and locally saved annotations inside their own context. */
export function annotationsForContext<T extends {courrierId:string;fichierId?:string|null}>(annotations:readonly T[],courrierId:string,fichierId?:string):T[] {
  return annotations.filter(annotation=>annotation.courrierId===courrierId
    && (fichierId===undefined || annotation.fichierId===fichierId));
}
