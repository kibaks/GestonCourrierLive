export type OrientationOptions = {
  requiresDgAnnotation: boolean;
  targets: Array<{ id: string; nom: string; role: string }>;
  instructions: Array<{ id: string; contenu: string; fichierId?: string; page?: number }>;
};
export type OrientationResult = { doneIds: string[]; errors: Array<{ id: string; message: string }> };

export function resolveOrientationSubmission(options: OrientationOptions, targetId?: string, annotationId?: string) {
  const chosenId = targetId || (options.targets.length === 1 ? options.targets[0].id : '');
  if (!options.targets.length) throw new Error('Aucune orientation disponible à cette étape. Consultez le circuit du courrier.');
  if (!chosenId) throw new Error('Choisissez le prochain responsable du circuit.');
  if (!options.targets.some(target => target.id === chosenId)) throw new Error('La cible choisie ne correspond plus à l’étape autorisée du circuit. Rechargez les cibles.');
  if (options.requiresDgAnnotation && !options.instructions.some(instruction => instruction.id === annotationId)) {
    throw new Error('Sélectionnez l’instruction du DG avant la transmission.');
  }
  return { assigneA: chosenId, ...(options.requiresDgAnnotation ? { dgAnnotationId: annotationId } : {}) };
}

export async function executeOrientationBatch(ids: string[], send: (id: string) => Promise<unknown>, progress?: (percent: number) => void): Promise<OrientationResult> {
  const result: OrientationResult = { doneIds: [], errors: [] };
  for (const [index, id] of ids.entries()) {
    try { await send(id); result.doneIds.push(id); }
    catch (error) { result.errors.push({ id, message: error instanceof Error ? error.message : 'Transmission impossible.' }); }
    progress?.(Math.round(((index + 1) / ids.length) * 100));
  }
  return result;
}

export function orientationResultMessage(result: OrientationResult, reference: (id: string) => string) {
  const done = result.doneIds.length;
  const summary = done > 0 ? `${done} courrier(s) orienté(s).` : 'Aucun courrier n’a été orienté.';
  const errors = result.errors.map(error => `${reference(error.id)} : ${error.message}`);
  return {
    type: (errors.length || !done ? 'error' : 'success') as 'error' | 'success',
    message: summary + (errors.length ? `\n${errors.length} courrier(s) non orienté(s).\n\n${errors.join('\n')}` : ''),
  };
}
